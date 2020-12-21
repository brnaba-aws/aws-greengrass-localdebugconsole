/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.messageutils;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * A pre-packing object representing a client API call. The server cannot process this object. Instead, it
 * should be packed in a PackedRequest before sending.
 */
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
public class Request {
    public String call;
    public String[] args;
}
