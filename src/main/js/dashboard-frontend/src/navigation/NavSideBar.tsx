/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { withRouter, useHistory } from "react-router-dom";

import {SideNavigation, SideNavigationProps} from "@awsui/components-react";
import { routes } from "./constRoutes";
import { PROJECT_NAME } from "../util/constNames";

const header = {
  href: "/",
  text: `AWS IoT ${PROJECT_NAME}`,
};

const footerItems: SideNavigationProps.Item[] = [
  { type: "divider" },
  {
    type: "link",
    text: "Documentation",
    href: "https://docs.aws.amazon.com/console/greengrass/v2/local",
    external: true,
  },
];

const items = routes
  .filter((route) => route.show)
  .map((route) => ({ type: "link", text: route.title, href: route.routePath } as SideNavigationProps.Item))
  .concat(footerItems);

function NavSideBar() {
  let history = useHistory();
  function onFollowHandler(ev: any) {
    if (!ev.detail.external) {
      ev.preventDefault();
      if (ev.detail.href) {
        history.push(ev.detail.href);
      }
    }
  }
  return (
    <SideNavigation
      items={items}
      header={header}
      activeHref={history.location.pathname}
      onFollow={onFollowHandler}
    />
  );
}

// @ts-ignore
export default withRouter(NavSideBar);
