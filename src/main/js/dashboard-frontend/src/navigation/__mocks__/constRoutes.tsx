/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { SERVICE_ROUTE_HREF_PREFIX } from "../../util/constNames";

interface RouteType {
  routePath: string;
  title: string;
  show: boolean;
}

export const routes: RouteType[] = [
  {
    routePath: "/",
    title: "Console",
    show: true,
  },
  {
    routePath: "/exists",
    title: "This route exists",
    show: true,
  },
  {
    routePath: "/exists/as/well",
    title: "This route exists as well",
    show: false,
  },
  {
    routePath: SERVICE_ROUTE_HREF_PREFIX.slice(1, -1),
    title: "Components",
    show: true,
  },
  {
    routePath: SERVICE_ROUTE_HREF_PREFIX.substring(1) + ":component",
    title: "Component Details",
    show: false,
  },
];
