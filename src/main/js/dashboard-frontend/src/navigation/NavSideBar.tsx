/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { withRouter, useHistory } from "react-router-dom";

import {SideNavigation, SideNavigationProps} from "@cloudscape-design/components";
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
    // Get proper docs link depending on if we're using the China partition
    // @ts-ignore
    href: window.CHINA_PARTITION ? "https://docs.amazonaws.cn/console/greengrass/v2/local"
        : "https://docs.aws.amazon.com/console/greengrass/v2/local",
    external: true,
  },
];

const items = routes
  .filter((route) => route.show)
  .map((route) => ({ type: "link", text: route.title, href: "#" + route.routePath } as SideNavigationProps.Item))
  .concat(footerItems);

function NavSideBar() {
  let history = useHistory();
  function onFollowHandler(ev: any) {
    if (!ev.detail.external) {
      ev.preventDefault();
      if (ev.detail.href) {
        // Strip leading # that we put on the link
        history.push(ev.detail.href.substring(1));
      }
    }
  }

  return (
    <SideNavigation
      items={items}
      header={header}
      activeHref={"#" + history.location.pathname}
      onFollow={onFollowHandler}
    />
  );
}

export default withRouter(NavSideBar);
