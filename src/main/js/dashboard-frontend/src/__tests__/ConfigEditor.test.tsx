/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

jest.mock("../communication/ServerEndpoint");
jest.mock("../index");

import React from "react";

import wrapper from "@cloudscape-design/components/test-utils/dom";

import 'mutationobserver-shim';
import { render } from "@testing-library/react";
import {
  IF_config_get_is_successful_THEN_config_is_editable,
  IF_config_get_is_unsuccessful_THEN_an_error_is_displayed,
} from "../communication/__mocks__/ServerEndpoint";
import { ConfigEditor } from "../components/details/ConfigEditor";
import { mockConfigError } from "../communication/__mocks__/mockedData";

test("If config get is successful then config is editable", (done) => {
  let { container } = render(
    <ConfigEditor
      dark={false}
      service={IF_config_get_is_successful_THEN_config_is_editable}
    />
  );
  let configEditor = wrapper(container);
  setTimeout(() => {
    expect(
      configEditor.findButton()!.getElement()
    ).not.toBeDisabled();
    try {
      configEditor.findFlashbar()!.findItems()[0].findContent()!.getElement()
        .innerHTML;
      fail("Flashbar contains items even when config load is successful");
    } catch (e) {}
    expect(
      configEditor
        .find(".ace_text-input")!
        .getElement()
        .getAttributeNames()
        .includes("readonly")
    ).toBe(false);
    done();
  }, 50);
});

test("If config get is unsuccessful then an error is displayed", (done) => {
  let { container } = render(
    <ConfigEditor
      dark={false}
      service={IF_config_get_is_unsuccessful_THEN_an_error_is_displayed}
    />
  );
  let configEditor = wrapper(container);
  setTimeout(() => {
    expect(
      configEditor.findButton()!.getElement()
    ).toBeDisabled();
    expect(
      configEditor.findFlashbar()!.findItems()[0].findContent()!.getElement()
        .innerHTML
    ).toContain(mockConfigError);
    expect(
      configEditor
        .find(".ace_text-input")!
        .getElement()
        .getAttributeNames()
        .includes("readonly")
    ).toBe(true);
    done();
  }, 50);
});

test("If config update is successful then flashbar displays new message", (done) => {
  let { container } = render(
    <ConfigEditor
      dark={false}
      service={IF_config_get_is_successful_THEN_config_is_editable}
    />
  );
  let configEditor = wrapper(container);

  setTimeout(() => {
    configEditor.findButton()!.click();
    setTimeout(() => {
      expect(
          configEditor.findFlashbar()!.findItems()[0].getElement().innerHTML
      ).toContain("updated successfully");
      done();
    }, 50);
  }, 50);
});
