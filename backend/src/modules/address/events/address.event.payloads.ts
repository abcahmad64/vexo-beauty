export interface AddressBaseEventPayload {
  addressId: string;
  userId: string;
  occurredAt: Date;
}

export interface AddressCreatedEventPayload extends AddressBaseEventPayload {
  isDefault: boolean;
}

export interface AddressUpdatedEventPayload extends AddressBaseEventPayload {
  changedFields: string[];
  isDefault?: boolean;
}

export interface AddressDeletedEventPayload extends AddressBaseEventPayload {
  wasDefault: boolean;
}

export interface AddressDefaultChangedEventPayload extends AddressBaseEventPayload {
  previousDefaultAddressId?: string | null;
}
