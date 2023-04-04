/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useLocation } from "react-router-dom";
import { routes } from "./constRoutes";
import { BreadcrumbGroup } from "@cloudscape-design/components";
import { PROJECT_NAME, SERVICE_ROUTE_HREF_PREFIX } from "../util/constNames";
import {BreadcrumbGroupProps} from "@cloudscape-design/components/breadcrumb-group/interfaces";

export function findTitle(href: string) {
  if (href.startsWith(SERVICE_ROUTE_HREF_PREFIX))
    return `${href.substring(SERVICE_ROUTE_HREF_PREFIX.length)}`;
  let retval = "null";
  const stripped = href.substring(1); // strip leading '#'
  routes.forEach((route) => {
    if (route.routePath === stripped) retval = route.title;
  });
  return retval;
}

export function crumbs(pathname: string): BreadcrumbGroupProps.Item[] {
  //creates a list of breadcrumb subitems, e.g. [#/, #/components, #/components/service]
  let splits: string[] = pathname.split("/");
  splits.forEach((_, i) =>
    i !== 0 ? (splits[i] = splits[i - 1] + "/" + splits[i]) : (splits[i] = "#")
  );
  splits[0] += "/";

  const crumbs = splits.map((href) => ({ text: findTitle(href), href: href }));
  crumbs[0].text = PROJECT_NAME;
  return crumbs;
}

function Breadcrumbs() {
  // gets the hash route, e.g. #/components/service
  let pathname = useLocation().pathname;

  return <BreadcrumbGroup items={crumbs(pathname)} />;
}

export default Breadcrumbs;
