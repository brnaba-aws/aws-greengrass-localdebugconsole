/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { fullRangeList } from "../communication/__mocks__/mockedData";

jest.mock("../communication/ServerEndpoint");
jest.mock("../index");

import { HashRouter } from "react-router-dom";

import React from "react";

import wrapper, {
  ElementWrapper,
} from "@cloudscape-design/components/test-utils/dom";

import 'mutationobserver-shim';
import { render } from "@testing-library/react";

import ComponentTable from "../components/ComponentTable";
import { SERVICE_ROUTE_HREF_PREFIX } from "../util/constNames";

let componentTable: ElementWrapper<Element>;

beforeEach(async () => {
  let { container } = render(
    <HashRouter>
      <ComponentTable />
    </HashRouter>
  );
  componentTable = wrapper(container);
});

test("Table fetches and displays data from the server", () => {
  let rows = componentTable.findTable()!.findRows();
  expect(rows.length).toEqual(4); // user-defined elements from fullRangeList
});

test("Service item points to the right href", () => {
  expect(
      componentTable
          .findTable()!
          .findBodyCell(1, 2)!
          .getElement()!
          .firstElementChild!
          .getAttribute("href")
  ).toEqual(SERVICE_ROUTE_HREF_PREFIX + fullRangeList[0].name);
});

