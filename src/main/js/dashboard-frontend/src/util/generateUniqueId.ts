/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

let counter = 0;

export default function generateUniqueId(prefix?: string): string {
    return `${prefix ? prefix : ''}${counter++}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}
