import { Module } from '@nestjs/common';

import { PrismaModule } from '../../core/prisma/prisma.module';

import { SearchEventHandler } from './events/search.event.handler';

import { SearchEventPublisher } from './events/search.event.publisher';

import { SearchController } from './search.controller';

import { PersianSearchService } from './services/persian-search.service';

import { SearchService } from './services/search.service';

import { SearchSuggestionService } from './services/search-suggestion.service';

@Module({
  imports: [PrismaModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    PersianSearchService,
    SearchSuggestionService,
    SearchEventPublisher,
    SearchEventHandler,
  ],
  exports: [SearchService, PersianSearchService, SearchSuggestionService],
})
export class SearchModule {}
