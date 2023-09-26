/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useContext, useEffect, useReducer, useState} from "react";
import {withRouter} from "react-router-dom";
import {
    Box,
    Button,
    CollectionPreferences,
    CollectionPreferencesProps,
    ColumnLayout,
    Container,
    ContentLayout,
    Form,
    FormField,
    Header,
    Input,
    Link,
    Modal,
    Select,
    SpaceBetween,
    Table,
    TableProps,
    Tabs,
    TabsProps,
    TextFilter,
} from "@cloudscape-design/components";
import model1 from "../static/streammanagerModel.json"

import {APICall, ConfigMessage} from "../util/CommUtils";

import {
    formatBytes,
    generateRandom4DigitNumber,
    getExportDefinitionType,
    Persistence,
    StrategyOnFull,
    Stream,
    StreamManagerComponentConfiguration,
    StreamManagerReducer
} from "../util/StreamManagerUtils";
import {DefaultContext, SERVER} from "../index";
import {STREAM_MANAGER_ROUTE_HREF_PREFIX} from "../util/constNames";
import PaginationRendering from "../util/PaginationRendering";
import StreamManagerResponseMessage from "../util/StreamManagerResponseMessage";
import DeleteModal from "./StreamManagerDeleteModal";

const model = model1.definitions;

function StreamManager() {
    const [filteringText, setFilteringText] = useState("")
    const [streamManagerStreamsList, setStreamManagerStreamsList] = useState<Stream[]>([])
    const [viewConfirmDelete, setViewConfirmDelete] = useState(false);
    const [viewConfirmCreateStream, setViewConfirmCreateStream] = useState(false);
    const [createStreamErrorText, setCreateStreamErrorText] = useState("");
    const [newStream, dispatch] = useReducer(StreamManagerReducer, {
        name: "new-stream",
        maxSize: model.MessageStreamDefinition.properties.maxSize.default,
        streamSegmentSize: model.MessageStreamDefinition.properties.streamSegmentSize.default,
        timeToLiveMillis: undefined,
        strategyOnFull: StrategyOnFull.OverwriteOldestData,
        persistence: Persistence.File,
        flushOnWrite: false,
        exportDefinition: Object.keys(model.ExportDefinition.properties).reduce((prev: any, id) => {
            prev[id] = [];
            return prev;
        }, {})
    });

    const defaultContext = useContext(DefaultContext);
    const [currentPageIndex, setCurrentPageIndex] = useState(1)
    const [streamManagerComponentConfiguration, setStreamManagerComponentConfiguration] = useState<StreamManagerComponentConfiguration>({
        Version: '-',
        JVM_ARGS: '-',
        LOG_LEVEL: '-',
        STREAM_MANAGER_AUTHENTICATE_CLIENT: '-',
        STREAM_MANAGER_EXPORTER_THREAD_POOL_SIZE: '-',
        STREAM_MANAGER_EXPORTER_MAX_BANDWIDTH: '-',
        STREAM_MANAGER_EXPORTER_S3_DESTINATION_MULTIPART_UPLOAD_MIN_PART_SIZE_BYTES: '-',
        STREAM_MANAGER_SERVER_PORT: '-',
        STREAM_MANAGER_STORE_ROOT_DIR: '-'
    });
    const [selectedStream, setSelectedStream] = useState<Stream[]>()
    const componentConfigurationItems = [
        [
            {
                field: "Version",
                value: streamManagerComponentConfiguration?.Version,
            },
            {
                field: "Port",
                value: streamManagerComponentConfiguration?.STREAM_MANAGER_SERVER_PORT.toString(),
            },
            {
                field: "Authenticate Clients",
                value: streamManagerComponentConfiguration.STREAM_MANAGER_AUTHENTICATE_CLIENT
            },
        ],
        [
            {
                field: "Export Max Bandwidth",
                value: streamManagerComponentConfiguration.STREAM_MANAGER_EXPORTER_MAX_BANDWIDTH,
            },
            {
                field: "Export Thread Pool Size",
                value: streamManagerComponentConfiguration.STREAM_MANAGER_EXPORTER_THREAD_POOL_SIZE
            },
            {
                field: "Export S3 Upload Min Part Size",
                value: streamManagerComponentConfiguration.STREAM_MANAGER_EXPORTER_S3_DESTINATION_MULTIPART_UPLOAD_MIN_PART_SIZE_BYTES,
            },
        ],
        [
            {
                field: "Root Path",
                value: streamManagerComponentConfiguration.STREAM_MANAGER_STORE_ROOT_DIR,
            },
            {
                field: "Log Level",
                value: streamManagerComponentConfiguration.LOG_LEVEL,
            },
            {
                field: "JVM Args",
                value: streamManagerComponentConfiguration.JVM_ARGS
            }
        ],
    ];
    const columnDefinitions: TableProps.ColumnDefinition<Stream>[] = [
        {
            id: "key",
            header: "key",
            cell: (e: Stream) => e.messageStreamInfo.definition.name
        },
        {
            id: "name",
            header: "Name",
            cell: (e: Stream) => <Link
                href={`${STREAM_MANAGER_ROUTE_HREF_PREFIX}${e.messageStreamInfo.definition.name}`}>{e.messageStreamInfo.definition.name}</Link>
        },
        {
            id: "maxSize",
            header: "Max Size",
            cell: (e: Stream) => formatBytes(e.messageStreamInfo.definition.maxSize)
        },
        {
            id: "streamSegmentSize",
            header: "Segment Size",
            cell: (e: Stream) => formatBytes(e.messageStreamInfo.definition.streamSegmentSize)
        },
        {
            id: "totalBytes",
            header: "Total Size",
            cell: (e: Stream) => formatBytes(e.messageStreamInfo.storageStatus.totalBytes)
        },
        {
            id: "persistence",
            header: "Persistence",
            cell: (e: Stream) => (e.messageStreamInfo.definition.persistence === 0 ? "File" : "Memory")
        },
        {
            id: "strategyOnFull",
            header: "Strategy",
            cell: (e: Stream) => (e.messageStreamInfo.definition.strategyOnFull === 0 ? "RejectNewData" : "OverwriteOldestData")
        },
        {
            id: "oldestSequenceNumber",
            header: "Oldest sequence number",
            cell: (e: Stream) => e.messageStreamInfo.storageStatus.oldestSequenceNumber
        },
        {
            id: "newestSequenceNumber",
            header: "Newest sequence number",
            cell: (e: Stream) => e.messageStreamInfo.storageStatus.newestSequenceNumber
        },
        {
            id: "timeToLiveMillis",
            header: "TTL on message",
            cell: (e: Stream) => (!e.messageStreamInfo.definition.timeToLiveMillis ? 'None' : e.messageStreamInfo.definition.timeToLiveMillis)
        },
        {
            id: "flushOnWrite",
            header: "Flush on write",
            cell: (e: Stream) => (e.messageStreamInfo.definition.flushOnWrite ? 'true' : 'false')
        },
        {
            id: "exportDefinition",
            header: "Export definition",
            cell: e => getExportDefinitionType(e.messageStreamInfo.definition.exportDefinition || Object.keys(model.ExportDefinition.properties).reduce((prev: any, id) => {
                prev[id] = [];
                return prev;
            }, {})
            )
        }
    ];

    let storedPreference = localStorage.getItem('streamPreferences');
    if (!storedPreference) {
        storedPreference = JSON.stringify({
            pageSize: 10,
            visibleContent: ["name", "persistence", "strategyOnFull", "maxSize", "exportDefinition"]
        })
    }
    const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>(JSON.parse(storedPreference));

    useEffect(() => {
        getStreamManagerComponentConfiguration();
        listStreams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPageIndex, preferences]);


    async function getStreamManagerComponentConfiguration() {
        const deviceDetailsResponse = await SERVER.sendRequest({call: APICall.getDeviceDetails, args: []});
        if (deviceDetailsResponse) {
            const rootPath = deviceDetailsResponse.rootPath;
            const getComponentResponse = await SERVER.sendRequest({
                call: APICall.getComponent,
                args: ["aws.greengrass.StreamManager"]
            });

            if (getComponentResponse) {
                const configMessage: ConfigMessage = await SERVER.sendRequest({
                    call: APICall.getConfig,
                    args: ["aws.greengrass.StreamManager"]
                });

                let streamManagerServerPort = "";
                let streamManagerAuthenticateClient = "";
                let logLevel = "";
                let jvmArgs = "";
                let streamManagerExporterMaxBandwidth = "";
                let streamManagerS3UploadMinPart = "";
                let streamManagerThreadPoolSize = "";
                let streamManagerStoreRootDir = "";

                if (configMessage.successful) {
                    streamManagerServerPort = configMessage.yaml.match(/STREAM_MANAGER_SERVER_PORT:\s+"(\d+)"/)?.[1] || "-";
                    streamManagerAuthenticateClient = configMessage.yaml.match(/STREAM_MANAGER_AUTHENTICATE_CLIENT:\s+"(\w+)"/)?.[1] || "";
                    logLevel = configMessage.yaml.match(/LOG_LEVEL:\s+"(\w+)"/)?.[1] || "";
                    jvmArgs = configMessage.yaml.match(/JVM_ARGS:\s+"(\w+)"/)?.[1] || "";
                    streamManagerExporterMaxBandwidth = configMessage.yaml.match(/STREAM_MANAGER_EXPORTER_MAX_BANDWIDTH:\s+"(\d+)"/)?.[1] || "";
                    streamManagerS3UploadMinPart = configMessage.yaml.match(/STREAM_MANAGER_EXPORTER_S3_DESTINATION_MULTIPART_UPLOAD_MIN_PART_SIZE_BYTES:\s+"(\d+)"/)?.[1] || "";
                    streamManagerThreadPoolSize = configMessage.yaml.match(/STREAM_MANAGER_EXPORTER_THREAD_POOL_SIZE:\s+"(\d+)"/)?.[1] || "";
                    streamManagerStoreRootDir = configMessage.yaml.match(/STREAM_MANAGER_STORE_ROOT_DIR:\s+"([^"]+)"/)?.[1] || "";

                    if (streamManagerStoreRootDir === '.') {
                        streamManagerStoreRootDir = rootPath + '/work/aws.greengrass.StreamManager'
                    }
                }

                setStreamManagerComponentConfiguration({
                    Version: getComponentResponse?.version,
                    JVM_ARGS: jvmArgs,
                    LOG_LEVEL: logLevel,
                    STREAM_MANAGER_AUTHENTICATE_CLIENT: streamManagerAuthenticateClient,
                    STREAM_MANAGER_EXPORTER_MAX_BANDWIDTH: formatBytes(parseInt(streamManagerExporterMaxBandwidth || "0", 10)) + "/s",
                    STREAM_MANAGER_EXPORTER_S3_DESTINATION_MULTIPART_UPLOAD_MIN_PART_SIZE_BYTES: formatBytes(parseInt(streamManagerS3UploadMinPart || "0", 10)),
                    STREAM_MANAGER_SERVER_PORT: streamManagerServerPort,
                    STREAM_MANAGER_STORE_ROOT_DIR: streamManagerStoreRootDir,
                    STREAM_MANAGER_EXPORTER_THREAD_POOL_SIZE: streamManagerThreadPoolSize
                })
            }
        }
    }

    async function deleteMessageStream(streamName: string) {
        try {
            const response: StreamManagerResponseMessage = await SERVER.sendRequest({
                call: APICall.streamManagerDeleteMessageStream,
                args: [streamName]
            });
            defaultContext.addFlashItem!({
                type: response.successful ? 'success' : 'error',
                header: response.successful ? `Deleted ${streamName} successfully` : `Error deleting ${streamName}`,
                content: response.errorMsg
            });
            listStreams();
        } catch (e) {
            defaultContext.addFlashItem!({
                type: 'error',
                header: `Error deleting ${streamName}`,
                content: e
            });
        }
    }

    async function listStreams() {
        const response: StreamManagerResponseMessage = await SERVER.sendRequest({
            call: APICall.streamManagerListStreams,
            args: []
        });
        if (response) {
            if (response.successful) {
                const streams: Stream[] = [];
                for (const [index, streamName] of response.streamsList.entries()) {
                    const response: StreamManagerResponseMessage = await SERVER.sendRequest({
                        call: APICall.streamManagerDescribeStream,
                        args: [streamName]
                    });
                    if (response && response.successful && response.messageStreamInfo) {
                        streams.push({
                            key: index,
                            messageStreamInfo: response.messageStreamInfo
                        });
                    }
                }
                setStreamManagerStreamsList(streams);
            } else {
                defaultContext.addFlashItem!({
                    type: 'error',
                    header: 'Error',
                    content: response.errorMsg
                });
            }
        }
    }

    const onClickRefresh = listStreams;

    const onClickDelete = () => {
        setViewConfirmDelete(true)
    }

    const onDismiss = () => {
        setViewConfirmDelete(false);
        setViewConfirmCreateStream(false);
        dispatch({type: 'clear', callbackError: setCreateStreamErrorText});
        setCreateStreamErrorText('');
    }

    const confirmDelete = () => {
        if (selectedStream) {
            deleteMessageStream(selectedStream[0].messageStreamInfo.definition.name)
            setViewConfirmDelete(false);
            setSelectedStream([]);
        }
    }

    const onClickCreateStream = () => {
        dispatch({
            type: 'set_name',
            payload: `${newStream.name}-${generateRandom4DigitNumber()}`,
            callbackError: setCreateStreamErrorText
        })
        setViewConfirmCreateStream(true);
    }

    const confirmCreateStream = async () => {
        const response: StreamManagerResponseMessage = await SERVER.sendRequest({
            call: APICall.streamManagerCreateMessageStream,
            args: [JSON.stringify(newStream)]
        });
        if (response.successful) {
            setViewConfirmCreateStream(false);
            defaultContext.addFlashItem!({
                type: 'success',
                header: `Created ${newStream.name} successfully`,
                content: response.errorMsg
            });
            dispatch({type: 'clear', callbackError: setCreateStreamErrorText});
            setCreateStreamErrorText('');
            listStreams();
        } else {
            setCreateStreamErrorText(response.errorMsg ? response.errorMsg : 'Unknown error');
        }
    }

    function OnPageIndexChangedHandler(pageIndex: number) {
        setCurrentPageIndex(pageIndex);
        listStreams();
    }

    const tabs: TabsProps.Tab[] = [
        {
            id: "tab1",
            label: "Streams",
            content: (
                <Table
                    empty={
                        <Box textAlign="center" color="inherit">
                            <b>No stream</b>
                            <Box
                                padding={{bottom: "s"}}
                                variant="p"
                                color="inherit"
                            >
                                No streams to display.
                            </Box>
                        </Box>
                    }
                    filter={
                        <TextFilter
                            filteringPlaceholder="Find stream"
                            filteringText={filteringText}
                            onChange={({detail}) => setFilteringText(detail.filteringText)}
                        />
                    }
                    selectionType="single"
                    trackBy="key"
                    selectedItems={selectedStream}
                    loadingText="Loading streams"
                    items={streamManagerStreamsList.slice((currentPageIndex - 1) * (preferences.pageSize || 10), (currentPageIndex - 1) * (preferences.pageSize || 10) + (preferences.pageSize || 10)).filter((s: Stream) => s.messageStreamInfo.definition.name.toLowerCase().includes(filteringText.toLowerCase()))}
                    onSelectionChange={(e: any) => {
                        setSelectedStream(streamManagerStreamsList.filter((s: Stream) => s.messageStreamInfo.definition.name === e.detail.selectedItems[0].messageStreamInfo.definition.name))
                    }}
                    columnDefinitions={columnDefinitions}
                    visibleColumns={preferences.visibleContent}
                    preferences={
                        <CollectionPreferences
                            visibleContentPreference={{
                                title: "Visible columns",
                                options: [{
                                    label: "", options: [
                                        {editable: false, label: "Name", id: "name"},
                                        {editable: true, label: "Persistence", id: "persistence"},
                                        {editable: true, label: "Strategy", id: "strategyOnFull"},
                                        {editable: true, label: "Max size", id: "maxSize"},
                                        {editable: true, label: "Segment Size", id: "streamSegmentSize"},
                                        {editable: true, label: "Flush on write", id: "flushOnWrite"},
                                        {editable: true, label: "Time to live", id: "timeToLiveMillis"},
                                        {editable: true, label: "Total Size", id: "totalBytes"},
                                        {editable: true, label: "Newest sequence Number", id: "newestSequenceNumber"},
                                        {editable: true, label: "Oldest sequence Number", id: "oldestSequenceNumber"},
                                        {editable: true, label: "Exports", id: "exportDefinition"}
                                    ]
                                }]
                            }}
                            pageSizePreference={{
                                title: "Page size",
                                options: [
                                    {value: 5, label: "5"},
                                    {value: 10, label: "10"},
                                    {value: 50, label: "50"}]
                            }}
                            title={"Preferences"}
                            confirmLabel={"Ok"}
                            cancelLabel={"Cancel"}
                            preferences={preferences}
                            onConfirm={({detail}) => {
                                setPreferences(detail);
                                localStorage.setItem("streamPreferences", JSON.stringify(detail))
                            }}
                        />
                    }
                    header={
                        <Header
                            counter={`(${streamManagerStreamsList.length})`}
                            actions={
                                <SpaceBetween direction="horizontal" size="xs">
                                    <Button
                                        onClick={onClickRefresh}
                                        iconName="refresh"
                                        wrapText={false}
                                        disabled={false}
                                    >
                                    </Button>
                                    <Button
                                        onClick={onClickCreateStream}
                                        wrapText={false}
                                        iconName="add-plus"
                                    >
                                        Create stream
                                    </Button>
                                    <Button
                                        onClick={onClickDelete}
                                        wrapText={false}
                                        iconName="remove"
                                        disabled={!selectedStream?.length}
                                    >
                                        Delete
                                    </Button>
                                    {
                                        <DeleteModal isVisible={viewConfirmDelete}
                                                     header={selectedStream?.length ? `Delete ${selectedStream[0].messageStreamInfo.definition.name}` : ''}
                                                     onDismiss={onDismiss} confirmDelete={confirmDelete}/>
                                    }
                                    <Modal
                                        key={"createStream"}
                                        onDismiss={onDismiss}
                                        visible={viewConfirmCreateStream}
                                        size="medium"
                                        header={"Create new stream"}
                                    >
                                        <Form
                                            variant="embedded"
                                            actions={
                                                <SpaceBetween direction="horizontal" size="xs">
                                                    <Button
                                                        formAction="none"
                                                        variant="link"
                                                        onClick={onDismiss}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        loading={false}
                                                        disabled={createStreamErrorText.length !== 0}
                                                        variant="primary"
                                                        onClick={confirmCreateStream}
                                                    >
                                                        Create
                                                    </Button>
                                                </SpaceBetween>
                                            }
                                            errorText={createStreamErrorText !== '' ? createStreamErrorText : false}
                                        >
                                            <SpaceBetween direction="vertical" size="l">
                                                <FormField
                                                    label="Stream Name"
                                                    constraintText={model.MessageStreamDefinition.properties.name.description}
                                                >
                                                    <Input
                                                        value={newStream.name || ''}
                                                        onChange={(event) => dispatch({
                                                            type: 'set_name',
                                                            payload: event.detail.value,
                                                            callbackError: setCreateStreamErrorText
                                                        })}
                                                        disabled={false}
                                                    />
                                                </FormField>
                                                <FormField
                                                    label="Stream Max Size (in bytes)"
                                                    constraintText={model.MessageStreamDefinition.properties.maxSize.description}
                                                >
                                                    <Input
                                                        value={newStream.maxSize}
                                                        onChange={(event) => dispatch({
                                                            type: 'set_maxSize',
                                                            payload: event.detail.value,
                                                            callbackError: setCreateStreamErrorText
                                                        })}
                                                        disabled={false}
                                                        step={1024}
                                                        inputMode="decimal"
                                                        type="number"
                                                    />
                                                </FormField>
                                                <FormField
                                                    constraintText={model.MessageStreamDefinition.properties.streamSegmentSize.description}
                                                    label="Stream Segment Size (in bytes)"
                                                >
                                                    <Input
                                                        value={newStream.streamSegmentSize}
                                                        onChange={(event) => dispatch({
                                                            type: 'set_streamSegmentSize',
                                                            payload: event.detail.value,
                                                            callbackError: setCreateStreamErrorText
                                                        })}
                                                        disabled={false}
                                                        step={1024}
                                                        inputMode="decimal"
                                                        type="number"
                                                    />
                                                </FormField>
                                                <FormField
                                                    constraintText={model.MessageStreamDefinition.properties.timeToLiveMillis.description}
                                                    label="Time to live (in milliseconds)"
                                                >
                                                    <Input
                                                        value={newStream.timeToLiveMillis}
                                                        onChange={(event) => dispatch({
                                                            type: 'set_streamTtl',
                                                            payload: event.detail.value,
                                                            callbackError: setCreateStreamErrorText
                                                        })}
                                                        disabled={false}
                                                        inputMode="decimal"
                                                        type="number"
                                                    />
                                                </FormField>
                                                <FormField label="Strategy on full"
                                                           constraintText={model.MessageStreamDefinition.properties.strategyOnFull.description}>
                                                    <Select
                                                        options={[
                                                            {label: "OverwriteOldestData", value: "1"},
                                                            {label: "RejectNewData", value: "0"}
                                                        ]}
                                                        selectedOption={newStream.strategyOnFull === StrategyOnFull.OverwriteOldestData ? {
                                                            label: "OverwriteOldestData",
                                                            value: "1"
                                                        } : {label: "RejectNewData", value: "0"}}
                                                        onChange={({detail}) => dispatch({
                                                            type: 'set_strategyOnFull',
                                                            payload: detail.selectedOption.value,
                                                            callbackError: setCreateStreamErrorText
                                                        })}
                                                        disabled={false}
                                                    />
                                                </FormField>
                                                <FormField
                                                    label="Persistence"
                                                    constraintText={model.MessageStreamDefinition.properties.persistence.description}
                                                >
                                                    <Select
                                                        options={[
                                                            {label: "File", value: "0"},
                                                            {label: "Memory", value: "1"}
                                                        ]}
                                                        selectedOption={newStream.persistence === Persistence.File ? {
                                                            label: "File",
                                                            value: "0"
                                                        } : {label: "Memory", value: "1"}}
                                                        onChange={({detail}) => dispatch({
                                                            type: 'set_persistence',
                                                            payload: detail.selectedOption.value,
                                                            callbackError: setCreateStreamErrorText
                                                        })}
                                                        disabled={false}
                                                    />
                                                </FormField>
                                                {newStream.persistence === Persistence.File && <FormField
                                                    label="Flush on write"
                                                    constraintText={model.MessageStreamDefinition.properties.flushOnWrite.description}
                                                >
                                                    <Select
                                                        options={[
                                                            {label: "True", value: "0"},
                                                            {label: "False", value: "1"}
                                                        ]}
                                                        selectedOption={newStream.flushOnWrite === true ? {
                                                            label: "True",
                                                            value: "0"
                                                        } : {label: "False", value: "1"}}
                                                        onChange={({detail}) => dispatch({
                                                            type: 'set_flushOnWrite',
                                                            payload: detail.selectedOption.value,
                                                            callbackError: setCreateStreamErrorText
                                                        })}
                                                        disabled={false}
                                                    />
                                                </FormField>}
                                            </SpaceBetween>
                                        </Form>
                                    </Modal>
                                </SpaceBetween>
                            }
                        >
                            Streams
                        </Header>
                    }
                    pagination={
                        <PaginationRendering
                            numberOfItems={streamManagerStreamsList.length}
                            numberOfItemPerPage={preferences.pageSize || 1}
                            pageIndex={currentPageIndex}
                            onPageIndexChanged={(pageIndex: any) => OnPageIndexChangedHandler(pageIndex)}
                        />
                    }
                    variant="borderless"
                />
            ),
        },
        {
            id: "tab2",
            label: "Configuration",
            content: (
                <ColumnLayout columns={componentConfigurationItems.length} variant="text-grid">
                    {componentConfigurationItems.map((group, index) => (
                        <SpaceBetween size="xs" key={index}>
                            {group.map((item) => (
                                <div key={item.field}>
                                    <Box margin={{bottom: "xxxs"}} variant="awsui-key-label"
                                         color="text-label">{item.field}</Box>
                                    <div>{item.value}</div>
                                </div>
                            ))}
                        </SpaceBetween>
                    ))}
                </ColumnLayout>
            ),
        }
    ];


    return (
        <ContentLayout header={<Header variant={"h1"}>Stream Manager</Header>}>
            <Container>
                <Tabs tabs={tabs}></Tabs>
            </Container>
        </ContentLayout>
    );
}

export default withRouter(StreamManager);
