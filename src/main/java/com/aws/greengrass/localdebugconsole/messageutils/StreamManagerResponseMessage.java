/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import com.amazonaws.greengrass.streammanager.model.Message;
import com.amazonaws.greengrass.streammanager.model.MessageStreamInfo;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;

import java.util.Collections;
import java.util.List;

/**
 * The object sent to the client in response to getConfig() and updateConfig(). See DashboardAPI for more details.
 */
@EqualsAndHashCode
@AllArgsConstructor
public class StreamManagerResponseMessage {
    public boolean successful;
    public String errorMsg;
    public MessageStreamInfo messageStreamInfo;
    public List<Message> messagesList;
    public List<String> streamsList;

    // Default constructor
    public StreamManagerResponseMessage() {
        // Set default values for each attribute
        this.successful = false; // Default boolean value
        this.errorMsg = null; // Default null for String
        this.messageStreamInfo = null; // Default null for Object
        this.messagesList = Collections.emptyList(); // Default empty list
        this.streamsList = Collections.emptyList(); // Default empty list
    }
}
