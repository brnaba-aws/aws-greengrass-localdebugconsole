/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

export class CommunicationMessage {
  subId: string;
  subscribedTopic: string;
  topic: string;
  payload: string;
  constructor(
    subId: string,
    subscribedTopic: string,
    topic: string,
    payload: string,
  ) {
    this.subId = subId;
    this.subscribedTopic = subscribedTopic;
    this.topic = topic;
    this.payload = payload;
  }
}
