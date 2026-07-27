import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';

import { SearchEventType } from './search.event.types';

import {
  SearchPerformedEventPayload,
  SearchSuggestionsGeneratedEventPayload,
} from './search.event.payloads';

@Injectable()
export class SearchEventHandler {
  private readonly logger = new Logger(SearchEventHandler.name);

  @OnEvent(SearchEventType.SEARCH_PERFORMED)
  handleSearchPerformed(payload: SearchPerformedEventPayload): void {
    this.logger.log(
      `Search performed: scope=${payload.scope}; query=${payload.query ?? 'N/A'}; results=${payload.resultCount}`,
    );
  }

  @OnEvent(SearchEventType.SEARCH_SUGGESTIONS_GENERATED)
  handleSearchSuggestionsGenerated(
    payload: SearchSuggestionsGeneratedEventPayload,
  ): void {
    this.logger.log(
      `Search suggestions generated: query=${payload.query}; results=${payload.resultCount}`,
    );
  }
}
