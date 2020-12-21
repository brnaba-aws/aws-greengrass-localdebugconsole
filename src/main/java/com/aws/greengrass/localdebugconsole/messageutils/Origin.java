/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

public enum Origin {
    BUILTIN("Built-In"),
    USER("User");

    private final String name;

    Origin(String name) {
        this.name = name;
    }

    @Override
    public String toString() {
        return name;
    }
}
