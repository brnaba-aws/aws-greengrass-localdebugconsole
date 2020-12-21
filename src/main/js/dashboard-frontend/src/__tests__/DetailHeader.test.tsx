/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import ServerEndpoint from "../communication/ServerEndpoint";
import React from "react";

import wrapper, {ElementWrapper,} from "@awsui/components-react/test-utils/dom";

import {render} from "@testing-library/react";
import 'mutationobserver-shim';

import {SERVER} from "../index";
import {multipleComponentUpdates} from "../communication/__mocks__/mockedData";
import DetailHeader from "../components/details/DetailHeader";
import {APICall} from "../util/CommUtils";

jest.mock("../communication/ServerEndpoint");
jest.mock("../index");

let detailHeader: ElementWrapper;

beforeEach(async () => {
  let { container } = render(
    <DetailHeader service={multipleComponentUpdates[0].name} />
  );
  detailHeader = wrapper(container);
});

test("Buttons are enabled based on service status", () => {
  SERVER.pushComponentUpdate(0);
  expect(
    // @ts-ignore
    detailHeader.findButton(".start").getElement()
  ).not.toBeDisabled();
  expect(
    // @ts-ignore
    detailHeader.findButton(".stop").getElement()
  ).not.toBeDisabled();

  SERVER.pushComponentUpdate(1);
  expect(
    // @ts-ignore
    detailHeader.findButton(".start").getElement()
  ).toBeDisabled();
  expect(
      // @ts-ignore
    detailHeader.findButton(".stop").getElement()
  ).not.toBeDisabled();

  SERVER.pushComponentUpdate(2);
  expect(
      // @ts-ignore
    detailHeader.findButton(".start").getElement()
  ).not.toBeDisabled();
  expect(
    // @ts-ignore
    detailHeader.findButton(".stop").getElement()
  ).toBeDisabled();
});

test("Buttons function properly", (done) => {
  SERVER.pushComponentUpdate(0);
  const reqSpy = jest.spyOn(ServerEndpoint.prototype, "sendRequest");
  // @ts-ignore
  detailHeader.findButton(".start").click();
  // @ts-ignore
  detailHeader.findButton(".stop").click();
  // @ts-ignore
  detailHeader.findButton(".reinstall").click();
  setTimeout(() => {
    expect(reqSpy).toHaveBeenNthCalledWith(1, {
      call: APICall.startComponent,
      args: expect.anything(),
    });
    expect(reqSpy).toHaveBeenNthCalledWith(2, {
      call: APICall.stopComponent,
      args: expect.anything(),
    });
    expect(reqSpy).toHaveBeenNthCalledWith(3, {
      call: APICall.reinstallComponent,
      args: expect.anything(),
    });
    done();
  }, 0);
});
