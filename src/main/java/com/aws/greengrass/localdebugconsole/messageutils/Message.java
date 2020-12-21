/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * An object representing messages sent to the client. Normal responses should have the same requestID as the request
 * to which they are responding. Server pushes will always have requestID of -1.
 */
@AllArgsConstructor
@NoArgsConstructor
@Getter
@EqualsAndHashCode
public class Message {
    private int messageType;
    private long requestID;
    private Object payload;

    public Message(int messageType, Object payload) {
        this.messageType = messageType;
        this.requestID = -1;
        this.payload = payload;
    }
}
