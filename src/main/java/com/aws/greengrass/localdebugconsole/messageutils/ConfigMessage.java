/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;

/**
 * The object sent to the client in response to getConfig() and updateConfig(). See DashboardAPI for more details.
 */
@EqualsAndHashCode
@AllArgsConstructor
public class ConfigMessage {
    public final boolean successful;
    public final String yaml;
    public final String errorMsg;
}
