/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * An object representing a full API request, sent by the client.
 */
@EqualsAndHashCode
@NoArgsConstructor
public class PackedRequest {
    public long requestID;
    public Request request;

    public PackedRequest(long requestID, String call, String[] args) {
        this.requestID = requestID;
        this.request = new Request(call, args);
    }
}

