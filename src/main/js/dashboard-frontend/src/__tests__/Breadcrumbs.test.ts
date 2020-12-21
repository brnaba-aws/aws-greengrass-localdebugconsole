/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

jest.mock("../navigation/constRoutes");

import { PROJECT_NAME, SERVICE_ROUTE_HREF_PREFIX } from "../util/constNames";
import { crumbs, findTitle } from "../navigation/Breadcrumbs";

test("Main page crumbs are correct", () => {
  const crumbTitles = crumbs("#/");
  expect(crumbTitles).toEqual(mainPageCrumbs);
});

test("Individual component crumbs are correct", () => {
  const crumbTitles = crumbs(SERVICE_ROUTE_HREF_PREFIX + "test");
  expect(crumbTitles).toEqual(testComponentCrumbs);
});

test("Finding included title", () => {
  expect(findTitle("#/exists")).toEqual("This route exists");
  expect(findTitle("#/exists/as/well")).toEqual("This route exists as well");
});

test("Finding excluded title", () => {
  expect(findTitle("/")).toEqual("null");
});

const mainPageCrumbs = [
  {
    text: PROJECT_NAME,
    href: "#/",
  },
  {
    text: "Console",
    href: "#/",
  },
];
const testComponentCrumbs = [
  {
    text: PROJECT_NAME,
    href: "#/",
  },
  {
    text: "Components",
    href: SERVICE_ROUTE_HREF_PREFIX.slice(0, -1), // remove trailing '/'
  },
  {
    text: "test",
    href: SERVICE_ROUTE_HREF_PREFIX + "test",
  },
];
