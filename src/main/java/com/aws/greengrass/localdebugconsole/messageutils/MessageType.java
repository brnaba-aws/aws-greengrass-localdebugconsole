/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

/**
 * Constants to distinguish different message types from each other.
 */
public class MessageType {
    public static final int RESPONSE = 0;
    public static final int COMPONENT_LIST = 1;
    public static final int DEPS_GRAPH = 2;
    public static final int COMPONENT_CHANGE = 3;
    public static final int COMPONENT_LOGS = 4;

    private MessageType() {
    }
}
