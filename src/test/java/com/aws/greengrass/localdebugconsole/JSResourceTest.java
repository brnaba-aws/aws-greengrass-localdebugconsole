/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

package com.aws.greengrass.localdebugconsole;

import com.aws.greengrass.testcommons.testutilities.GGExtension;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import java.io.File;
import java.net.URISyntaxException;
import java.net.URL;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(GGExtension.class)
public class JSResourceTest {
    @Test
    void test_if_js_resources_are_accessible() throws URISyntaxException {
        URL url = this.getClass().getClassLoader().getResource("node/dashboard-frontend/static/js/");
        assertNotNull(url, "Static js folder not found");
        List<String> files = Arrays.asList(new File(url.toURI()).list());
        assertNotEquals(0, files.size(), "Static js folder is empty");
    }
}
