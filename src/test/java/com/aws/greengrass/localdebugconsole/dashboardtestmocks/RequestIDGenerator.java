/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole.dashboardtestmocks;

public class RequestIDGenerator {
    private static long id = 0;
    public static synchronized long reqId() {
        ++id;
        if (id == Long.MAX_VALUE) {
            id = 1;
        }
        return id;
    }

    private RequestIDGenerator(){
    }
}
