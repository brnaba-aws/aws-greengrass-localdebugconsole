/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

import com.aws.greengrass.util.Pair;

@FunctionalInterface
public interface Authenticator {
    /**
     * Validate a username and password pair
     *
     * @param usernameAndPassword pair of username and password
     * @return true if it is valid
     */
    boolean isUsernameAndPasswordValid(Pair<String, String> usernameAndPassword);
}
