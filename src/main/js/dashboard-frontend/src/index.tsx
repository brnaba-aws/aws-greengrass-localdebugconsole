/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import "./index.css";
import React, {createContext, ReactNode, Suspense, useEffect, useState} from "react";
import ReactDOM from "react-dom";

import {HashRouter, Redirect, Route, Switch} from "react-router-dom";
import {routes} from "./navigation/constRoutes";
import NavSideBar from "./navigation/NavSideBar";

import "@cloudscape-design/global-styles/index.css"
import {AppLayout, Box, Flashbar, FlashbarProps, Spinner, Toggle} from "@cloudscape-design/components";
import ServerEndpoint from "./communication/ServerEndpoint";
import Breadcrumbs from "./navigation/Breadcrumbs";
import {SERVICE_ROUTE_HREF_PREFIX} from "./util/constNames";
import {ErrorBoundary} from "react-error-boundary";
import createPersistedState from 'use-persisted-state';
import generateUniqueId from "./util/generateUniqueId";
import {applyMode, Mode} from "@cloudscape-design/global-styles";


export var SERVER: ServerEndpoint;
const apiResource = (websocketError: (m: ReactNode) => void) => {
    if (!SERVER) {
        // @ts-ignore
        SERVER = new ServerEndpoint(window.WEBSOCKET_PORT, window.USERNAME, window.PASSWORD, 5, websocketError);
    }

    enum PromiseStatus {
        PENDING,
        RESOLVED,
        REJECTED,
    }

    let status = PromiseStatus.PENDING;
    let e: any;
    const prom = SERVER.initConnections()
        .then(() => {
            status = PromiseStatus.RESOLVED;
        })
        .catch((ex) => {
            status = PromiseStatus.REJECTED;
            e = ex;
        });

    return {
        read() {
            switch (status) {
                case PromiseStatus.PENDING:
                    throw prom;
                case PromiseStatus.RESOLVED:
                    return null;
                case PromiseStatus.REJECTED:
                    throw e;
            }
        }
    };
}

const Routes = ({apiResource}: {apiResource: any}) => {
    apiResource.read();
    return (<Switch>
        <Redirect
            exact
            from={SERVICE_ROUTE_HREF_PREFIX.slice(1, -1)}
            to="/"
        />
        {routes.map((route: any, index: any) => (
            <Route
                exact
                key={index}
                path={route.routePath}
                children={<route.main/>}
            />
        ))}
    </Switch>);
}

const useNavOpenState = createPersistedState<boolean>("gg.navOpen");
const useDarkModeState = createPersistedState<boolean>("gg.darkMode");
export const DefaultContext = createContext<{darkMode?: boolean, addFlashItem?: (i: FlashbarProps.MessageDefinition, removeExisting?: boolean) => void}>({});


const AppFunc = () => {
    const [flashItems, setFlashItems] = useState([] as FlashbarProps.MessageDefinition[]);
    const [navigationOpen, setNavigationOpen] = useNavOpenState(true);
    const [darkMode, setDarkMode] = useDarkModeState(window.matchMedia("(prefers-color-scheme: dark)").matches);
    useEffect(() => {
        applyMode(darkMode ? Mode.Dark : Mode.Light);
    }, [darkMode]);

    const addFlashbarItem = (item: FlashbarProps.MessageDefinition, removeExisting: boolean = true) => {
        item.dismissible = true;
        item.onDismiss = () => {
            setFlashItems((flashItems) => flashItems.filter(i => i.id !== item.id));
        };
        item.id = generateUniqueId();
        if (removeExisting) {
            setFlashItems([item]);
        } else {
            setFlashItems((flashItems) => [...flashItems, item]);
        }
    }

    const websocketError = (m: ReactNode) => {
        addFlashbarItem({
            type: 'error',
            header: 'Error connecting to WebSocket',
            content: m,
        })
    }

    const resource = apiResource(websocketError);

    return (
        <HashRouter>
            <AppLayout
                navigation={<>
                    <NavSideBar />
                    <Box margin={{left: "xl"}}>
                        <Toggle checked={darkMode} onChange={(e) => setDarkMode(e.detail.checked)}>Dark mode</Toggle>
                    </Box>
                </>}
                breadcrumbs={<Breadcrumbs />}
                notifications={<Flashbar items={flashItems} />}
                navigationOpen={navigationOpen}
                onNavigationChange={(e) => setNavigationOpen(e.detail.open)}
                toolsHide={true}
                contentType="default"
                content={
                <ErrorBoundary fallback={
                    <Box textAlign={"center"} padding={{top: "xxxl"}} variant={"h2"}>
                        Unable to connect to Greengrass
                    </Box>
                }>
                    <Suspense fallback={
                        <Box textAlign={"center"} padding={{top: "xxxl"}} variant={"h1"}>
                            Loading... <Spinner size={"big"}/>
                        </Box>
                    }>
                        <DefaultContext.Provider value={{darkMode, addFlashItem: addFlashbarItem}}>
                            <Routes apiResource={resource}/>
                        </DefaultContext.Provider>
                    </Suspense>
                </ErrorBoundary>
                }
            />
        </HashRouter>
    );
}

ReactDOM.render(<AppFunc />,
  document.getElementById("app")
);
