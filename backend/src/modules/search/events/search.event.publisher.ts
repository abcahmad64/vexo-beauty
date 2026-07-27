import { Injectable } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SearchEventType } from './search.event.types';

import {
  SearchPerformedEventPayload,
  SearchSuggestionsGeneratedEventPayload,
} from './search.event.payloads';

@Injectable()
export class SearchEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishSearchPerformed(payload: SearchPerformedEventPayload): void {
    this.eventEmitter.emit(SearchEventType.SEARCH_PERFORMED, payload);
  }

  publishSearchSuggestionsGenerated(
    payload: SearchSuggestionsGeneratedEventPayload,
  ): void {
    this.eventEmitter.emit(
      SearchEventType.SEARCH_SUGGESTIONS_GENERATED,
      payload,
    );
  }
}
