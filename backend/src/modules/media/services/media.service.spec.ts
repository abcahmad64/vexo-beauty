import { BadRequestException } from '@nestjs/common';

import { MediaService } from './media.service';

type PrismaMock = {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

type StorageMock = {
  uploadFile: jest.Mock;
  deleteByUrl: jest.Mock;
};

type EventPublisherMock = {
  publishFileUploaded: jest.Mock;
  publishUserAvatarUpdated: jest.Mock;
};

function avatarFile(
  mimetype: string,
  bytes: readonly number[],
): Express.Multer.File {
  const buffer = Buffer.from(bytes);

  return {
    fieldname: 'file',
    originalname: 'avatar.png',
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
  } as Express.Multer.File;
}

function activeUser(avatarUrl: string | null) {
  return {
    id: 'user-1',
    avatar_url: avatarUrl,
    deleted_at: null,
    status: 'ACTIVE',
  };
}

describe('MediaService customer avatar contract', () => {
  let prisma: PrismaMock;
  let storage: StorageMock;
  let eventPublisher: EventPublisherMock;
  let service: MediaService;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };

    storage = {
      uploadFile: jest.fn(),
      deleteByUrl: jest.fn(),
    };

    eventPublisher = {
      publishFileUploaded: jest.fn(),
      publishUserAvatarUpdated: jest.fn(),
    };

    service = new MediaService(
      prisma as never,
      storage as never,
      eventPublisher as never,
    );
  });

  it('rejects a spoofed image before storage is called', async () => {
    const file = avatarFile('image/png', [1, 2, 3, 4]);

    await expect(
      service.uploadUserAvatar('user-1', file, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('replaces a managed avatar and deletes the previous managed file', async () => {
    const file = avatarFile('image/jpeg', [0xff, 0xd8, 0xff, 0x01]);

    prisma.$queryRaw.mockResolvedValue([
      activeUser('/uploads/users/user-1/old-avatar.jpg'),
    ]);
    prisma.$executeRaw.mockResolvedValue(1);
    storage.uploadFile.mockResolvedValue({
      url: '/uploads/users/user-1/2026/07/new-avatar.jpg',
      key: 'users/user-1/2026/07/new-avatar.jpg',
      driver: 'local',
      folder: 'users',
      originalName: 'avatar.jpg',
      storedName: 'new-avatar.jpg',
      mimeType: 'image/jpeg',
      size: file.size,
      kind: 'image',
    });

    await expect(
      service.uploadUserAvatar('user-1', file, 'user-1'),
    ).resolves.toEqual({
      userId: 'user-1',
      avatarUrl: '/uploads/users/user-1/2026/07/new-avatar.jpg',
    });

    expect(storage.deleteByUrl).toHaveBeenCalledWith(
      '/uploads/users/user-1/old-avatar.jpg',
    );
    expect(eventPublisher.publishUserAvatarUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        avatarUrl: '/uploads/users/user-1/2026/07/new-avatar.jpg',
      }),
    );
  });

  it('removes the newly uploaded file when the database update fails', async () => {
    const file = avatarFile(
      'image/webp',
      [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
    );

    prisma.$queryRaw.mockResolvedValue([activeUser(null)]);
    prisma.$executeRaw.mockRejectedValue(new Error('database failed'));
    storage.uploadFile.mockResolvedValue({
      url: '/uploads/users/user-1/2026/07/new-avatar.webp',
      key: 'users/user-1/2026/07/new-avatar.webp',
      driver: 'local',
      folder: 'users',
      originalName: 'avatar.webp',
      storedName: 'new-avatar.webp',
      mimeType: 'image/webp',
      size: file.size,
      kind: 'image',
    });

    await expect(
      service.uploadUserAvatar('user-1', file, 'user-1'),
    ).rejects.toThrow('database failed');

    expect(storage.deleteByUrl).toHaveBeenCalledWith(
      '/uploads/users/user-1/2026/07/new-avatar.webp',
    );
  });

  it('removes the database reference and the managed avatar file', async () => {
    prisma.$queryRaw.mockResolvedValue([
      activeUser('/uploads/users/user-1/old-avatar.png'),
    ]);
    prisma.$executeRaw.mockResolvedValue(1);

    await expect(service.removeUserAvatar('user-1', 'user-1')).resolves.toEqual(
      {
        userId: 'user-1',
        avatarUrl: null,
      },
    );

    expect(storage.deleteByUrl).toHaveBeenCalledWith(
      '/uploads/users/user-1/old-avatar.png',
    );
    expect(eventPublisher.publishUserAvatarUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        avatarUrl: null,
      }),
    );
  });

  it('does not attempt to delete an externally hosted previous avatar', async () => {
    prisma.$queryRaw.mockResolvedValue([
      activeUser('https://legacy.example/avatar.png'),
    ]);
    prisma.$executeRaw.mockResolvedValue(1);

    await expect(service.removeUserAvatar('user-1', 'user-1')).resolves.toEqual(
      {
        userId: 'user-1',
        avatarUrl: null,
      },
    );

    expect(storage.deleteByUrl).not.toHaveBeenCalled();
  });

  it('rejects direct avatar URL changes from the customer route', async () => {
    await expect(
      service.setUserAvatar(
        'user-1',
        {
          url: '/uploads/users/user-1/other.png',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('preserves the existing admin URL-management contract', async () => {
    prisma.$queryRaw.mockResolvedValue([activeUser(null)]);
    prisma.$executeRaw.mockResolvedValue(1);

    await expect(
      service.setUserAvatar(
        'user-1',
        {
          url: 'https://cdn.example/avatar.png',
        },
        'admin-1',
      ),
    ).resolves.toEqual({
      userId: 'user-1',
      avatarUrl: 'https://cdn.example/avatar.png',
    });

    expect(eventPublisher.publishUserAvatarUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        avatarUrl: 'https://cdn.example/avatar.png',
      }),
    );
  });
});
