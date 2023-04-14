/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;

/**
 * Class for modeling communication messages. PubSub or MQTT message.
 */
@EqualsAndHashCode
@AllArgsConstructor
@Getter
public class CommunicationMessage implements Comparable<CommunicationMessage> {
    private final String subId;
    private final String subscribedTopic;
    private final String topic;
    private final String payload;

    // for unit testing
    @Override
    public int compareTo(CommunicationMessage o) {
        // Only both of them equals return 1 * 1
        return topic.compareTo(o.topic) * payload.compareTo(o.payload);
    }
}
