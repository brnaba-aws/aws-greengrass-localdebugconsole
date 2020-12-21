/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from "react";
import Overview from "../components/Overview";
import Arch from "../components/Arch";
import { SERVICE_ROUTE_HREF_PREFIX } from "../util/constNames";
import ComponentDetail from "../components/details/ComponentDetail";

interface RouteType {
  routePath: string; // displayed in the url
  title: string; // displayed in the navigation panel
  show: boolean; // whether or not to show the page in the navigation panel
  main(): ReactNode; // the rendered page
}

/*
 * Add a route here for any new pages you create
 */
export const routes: RouteType[] = [
  {
    routePath: "/",
    title: "Console",
    show: true,
    main: () => <Overview />,
  },
  {
    routePath: "/arch",
    title: "Device Details",
    show: true,
    main: () => <Arch />,
  },
  {
    routePath: SERVICE_ROUTE_HREF_PREFIX.slice(1, -1),
    title: "Components",
    show: false,
    main: () => <div />,
  },
  {
    routePath: SERVICE_ROUTE_HREF_PREFIX.substring(1) + ":component",
    title: "Component Details",
    show: false,
    main: () => <ComponentDetail />,
  },
];
