/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import ServerEndpoint, { requestID } from "../communication/ServerEndpoint";
import { MockServer } from "../communication/__mocks__/MockServer";
import {
  forcePushGraph,
  forcePushList,
  mockComponentList,
  mockDepGraph,
} from "../communication/__mocks__/mockedData";
import { APICall, InternalAPICall } from "../util/CommUtils";

let mockServer: MockServer;
let SERVER: ServerEndpoint;

beforeAll(async () => {
  mockServer = new MockServer(4000);
  SERVER = new ServerEndpoint(4000, "", "", 1);
  await SERVER.initConnections();
  console.log("Connections made");
});

beforeEach(() => {
  // clear all caches
  SERVER.cachedComponentList = [];
});

describe("Test client-internal features", () => {
  test("Test requestID uniqueness", async () => {
    let n = 10;
    let awaits: Promise<number>[] = new Array(n);
    for (let i = 0; i < n; ++i) {
      awaits[i] = async_increment();
    }
    for (let i = 0; i < n; ++i) {
      await expect(awaits[i]).resolves.toEqual(i + 1);
    }
  });

  test("Test deferred promise timeout", () => {
    expect(SERVER.deferPromise(() => {}).race).rejects.toEqual(
      "Request timed out in 1 seconds"
    );
  });

  function sleep() {
    return new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
  }
  async function async_increment() {
    let reqID = requestID();
    await sleep();
    return reqID;
  }
});

test("Test reqCon promise return values", async () => {
  await expect(
    SERVER.sendRequest({ call: InternalAPICall.ping, args: ["test"] })
  ).resolves.toEqual(true);
});

test("Test multiple server pushes", (done) => {
  const a = jest.fn();
  SERVER.sendSubscriptionMessage(
    { call: APICall.subscribeToComponent, args: ["test"] },
    a
  );
  setTimeout(() => {
    expect(a).toBeCalledTimes(3);
    done();
  }, 200); // wait for data to be finished sending
});

describe("test force push table", () => {
  const a = jest.fn();
  const b = jest.fn();
  test("From empty cache", (done) => {
    SERVER.sendSubscriptionMessage(
      { call: APICall.subscribeToComponentList, args: [] },
      a
    );
    setTimeout(() => {
      expect(a).toBeCalledWith(forcePushList);
      done();
    }, 50);
  });

  test("From nonempty cache", (done) => {
    SERVER.cachedComponentList = mockComponentList;
    SERVER.sendSubscriptionMessage(
      { call: APICall.subscribeToComponentList, args: [] },
      b
    );
    setTimeout(() => {
      expect(b).toBeCalledTimes(1);
      expect(b).toBeCalledWith(mockComponentList);
      done();
    }, 50); // wait for data to finish sending
  });
});

describe("test dependency graph subscription", () => {
  const a = jest.fn();
  const b = jest.fn();
  test("From empty cache", (done) => {
    SERVER.sendSubscriptionMessage(
      { call: APICall.subscribeToDependencyGraph, args: [] },
      a
    );
    setTimeout(() => {
      expect(a).toBeCalledWith(forcePushGraph);
      done();
    }, 50);
  });

  test("From nonempty cache", (done) => {
    SERVER.cachedDependencyGraph = mockDepGraph;
    SERVER.sendSubscriptionMessage(
      { call: APICall.subscribeToDependencyGraph, args: [] },
      b
    );
    setTimeout(() => {
      expect(b).toBeCalledTimes(1);
      expect(b).toBeCalledWith(mockDepGraph);
      done();
    }, 50); // wait for data to finish sending
  });
});

test("Test component list subscription and unsubscription", (done) => {
  const a = jest.fn();
  SERVER.sendSubscriptionMessage(
    { call: APICall.subscribeToComponentList, args: [] },
    a
  );
  mockServer.sendListUpdate();
  setTimeout(() => {
    SERVER.sendSubscriptionMessage(
      { call: APICall.unsubscribeToComponentList, args: [] },
      a
    );
    mockServer.sendListUpdate();
  }, 50);
  setTimeout(() => {
    expect(a).toBeCalledTimes(2);
    done();
  }, 100); // wait for sends to finish
});

test.skip("Test multiple component logs subscriptions", (done) => {
  const a = jest.fn();
  const b = jest.fn();
  const c = jest.fn();
  SERVER.sendSubscriptionMessage(
    { call: APICall.subscribeToComponentLogs, args: ["test1"] },
    a
  );
  SERVER.sendSubscriptionMessage(
    { call: APICall.subscribeToComponentLogs, args: ["test2"] },
    b
  );
  SERVER.sendSubscriptionMessage(
    { call: APICall.subscribeToComponentLogs, args: ["test3"] },
    c
  );
  // make sure to actually implement sendComponentLogUpdates in MockServer
  setTimeout(() => {
    expect(a).toBeCalledTimes(1);
    expect(b).toBeCalledTimes(2);
    expect(c).toBeCalledTimes(3);
    done();
  }, 50);
});

afterAll(() => {
  mockServer.server.close();
});
