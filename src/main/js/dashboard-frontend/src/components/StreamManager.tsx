/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useContext, useEffect, useState} from "react";
import {withRouter} from "react-router-dom";
import {
    ContentLayout,
    Header,
    Container,
    Tabs, TabsProps,
    ColumnLayout,
    SpaceBetween, 
    Box,
    Table,TableProps,
    TextFilter,
    CollectionPreferences, CollectionPreferencesProps,
    Button,
    Link,
    Modal,
    
} from "@cloudscape-design/components";

import { ConfigMessage } from "../util/CommUtils";

import {formatBytes, getExportDefinitionType} from "../util/StreamManager";
import { Stream, StreamManagerComponentConfiguration, ResponseMessage } from "../util/StreamManager";
import { SERVER, DefaultContext } from "../index";
import { APICall } from "../util/CommUtils";
import { ComponentItem } from "../util/ComponentItem";
import { STREAM_MANAGER_ROUTE_HREF_PREFIX } from "../util/constNames";
import PaginationRendering from "../util/PaginationRendering";

function StreamManager() {

    const [filteringText, setFilteringText] = useState("")
    const [streamManagerStreamsList, setStreamManagerStreamsList] = useState<Stream[]>([])
    const [requestStreamsListInProgress, setRequestStreamsListInProgress] = useState(false)
    const [viewConfirmDelete, setViewConfirmDelete] = useState(false);
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
    const items = [
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
                field: "Root path",
                value: streamManagerComponentConfiguration.STREAM_MANAGER_STORE_ROOT_DIR,
            },
            {
                field: "Authentication Client",
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
                cell: (e:Stream) => e.definition.name
            },
            {
                id: "name",
                header: "Name",
                cell: (e:Stream) => <Link href={`${STREAM_MANAGER_ROUTE_HREF_PREFIX}${e.definition.name}`}>{e.definition.name}</Link>
            },
            {
                id: "maxSize",
                header: "Max Size",
                cell: (e:Stream) => formatBytes(e.definition.maxSize)
            },
            {
                id: "streamSegmentSize",
                header: "Segment Size",
                cell: (e:Stream) => formatBytes(e.definition.streamSegmentSize)
            },
            {
                id: "totalBytes",
                header: "Total Size",
                cell: (e:Stream) => formatBytes(e.storageStatus.totalBytes)
            },
            {
                id: "persistence",
                header: "Persistence",
                cell: (e:Stream) => (e.definition.persistence === 0 ? "File":"Memory")
            },
            {
                id: "strategyOnFull",
                header: "Strategy",
                cell: (e:Stream) => (e.definition.strategyOnFull === 0 ? "RejectNewData": "OverwriteOldestData")
            },
            {
                id: "oldestSequenceNumber",
                header: "Oldest sequence number",
                cell: (e:Stream) => e.storageStatus.oldestSequenceNumber
            },
            {
                id: "newestSequenceNumber",
                header: "Newest sequence number",
                cell: (e:Stream) => e.storageStatus.newestSequenceNumber
            },
            {
                id: "timeToLiveMillis",
                header: "TTL on message",
                cell: (e:Stream) => (!e.definition.timeToLiveMillis?'None':e.definition.timeToLiveMillis)
            },
            {
                id: "flushOnWrite",
                header: "Flush on write",
                cell: (e:Stream) => (e.definition.flushOnWrite?'true':'false')
            },
            {
                id: "exportDefinition",
                header: "Export definition",
                cell: e => getExportDefinitionType(e.definition.exportDefinition)
            }
    ];
    const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({
        pageSize: 10,
        visibleContent: ["name", "persistence", "strategyOnFull", "streamSegmentSize", "maxSize", "totalBytes", "flushOnWrite", "timeToLiveMillis","oldestSequenceNumber", "newestSequenceNumber", "exportDefinition"]
    });

    useEffect(() => {   
        getStreamManagerComponentConfiguration();
        listStreams();
    },[currentPageIndex, preferences]);


    function getStreamManagerComponentConfiguration () {
        SERVER.sendRequest({ call: APICall.getDeviceDetails, args: [] }).then((response) => 
            {
                if (response){
                    const rootPath = response.rootPath;
                    SERVER.sendRequest({call: APICall.getComponent, args: ["aws.greengrass.StreamManager"]}).then(
                        (getComponentResponse:ComponentItem) => 
                        {
                            if (getComponentResponse) 
                            {
                                SERVER.sendRequest({call: APICall.getConfig, args: ["aws.greengrass.StreamManager"]}).then(
                                (response:ConfigMessage) => 
                                    {
                                        const streamManagerServerPort = response.yaml.match(/STREAM_MANAGER_SERVER_PORT:\s+"(\d+)"/)?.[1] || "-";
                                        const streamManagerAuthenticateClient = response.yaml.match(/STREAM_MANAGER_AUTHENTICATE_CLIENT:\s+"(\w+)"/)?.[1] || "";
                                        const logLevel = response.yaml.match(/LOG_LEVEL:\s+"(\w+)"/)?.[1] || "";
                                        const jvmArgs = response.yaml.match(/JVM_ARGS:\s+"(\w+)"/)?.[1] || "";
                                        const streamManagerExporterMaxBandwidth = response.yaml.match(/STREAM_MANAGER_EXPORTER_MAX_BANDWIDTH:\s+"(\d+)"/)?.[1] || "";
                                        const streamManagerS3UploadMinPart = response.yaml.match(/STREAM_MANAGER_EXPORTER_S3_DESTINATION_MULTIPART_UPLOAD_MIN_PART_SIZE_BYTES:\s+"(\d+)"/)?.[1] || "";
                                        const streamManagerThreadPoolSize = response.yaml.match(/STREAM_MANAGER_EXPORTER_THREAD_POOL_SIZE:\s+"(\d+)"/)?.[1] || "";
                                        let streamManagerStoreRootDir = response.yaml.match(/STREAM_MANAGER_STORE_ROOT_DIR:\s+"([^"]+)"/)?.[1] || "";
    
                                        if (streamManagerStoreRootDir === '.')
                                        {
                                            streamManagerStoreRootDir = rootPath + '/work/aws.greengrass.StreamManager'
                                        }
            
                                        setStreamManagerComponentConfiguration({
                                            Version: getComponentResponse?.version,
                                            JVM_ARGS: jvmArgs,
                                            LOG_LEVEL: logLevel,
                                            STREAM_MANAGER_AUTHENTICATE_CLIENT: streamManagerAuthenticateClient,
                                            STREAM_MANAGER_EXPORTER_MAX_BANDWIDTH: formatBytes(parseInt(streamManagerExporterMaxBandwidth || "0", 10)),
                                            STREAM_MANAGER_EXPORTER_S3_DESTINATION_MULTIPART_UPLOAD_MIN_PART_SIZE_BYTES: formatBytes(parseInt(streamManagerS3UploadMinPart || "0", 10)),
                                            STREAM_MANAGER_SERVER_PORT: streamManagerServerPort,
                                            STREAM_MANAGER_STORE_ROOT_DIR: streamManagerStoreRootDir,
                                            STREAM_MANAGER_EXPORTER_THREAD_POOL_SIZE:streamManagerThreadPoolSize
                                        })
                                    },
                                    (reason) => {
                                        console.log("Error in [StreamManager]: " + reason);
                                    }
                                );
                            }
                        },
                        (reason) => {
                          console.log("Error in [StreamManager]: " + reason);
                        }
                      );
                }
            },
            (reason) => {
                console.log("Error in [StreamManager]: " + reason);
            }
        );
    }

    function describeStream(streamName:string, index:number){
        SERVER.sendRequest({ call: APICall.streamManagerDescribeStream, args: [streamName] }).then(
            (response) => {
                if (response) {
                    const item:Stream = response;
                    item.key = index;
                    setStreamManagerStreamsList(prevList => [...prevList, item]);
                }
            },
            (reason) => {
              console.log("Error in [StreamManager]: " + reason);
            }
          );
    }

    function deleteMessageStream(streamName:string){
        setRequestStreamsListInProgress(true);
        SERVER.sendRequest({ call: APICall.streamManagerDeleteMessageStream, args: [streamName] }).then(
            (response:ResponseMessage) => {
                setRequestStreamsListInProgress(false);
                defaultContext.addFlashItem!({
                    type: response.successful === true?'success':'error',
                    header: response.successful === true?'Deleted ' + streamName + ' successfully':'Error deleting ' + streamName,
                    content: response.errorMsg
                });
                listStreams();
            },
            (reason) => {
                console.log("Error in [StreamManager]: " + reason);
                setRequestStreamsListInProgress(false);
                defaultContext.addFlashItem!({
                    type: 'error',
                    header: 'Error deleting ' + streamName,
                    content: reason
                });
            }
        )
    }

    function listStreams() {
        setStreamManagerStreamsList([]);
        setRequestStreamsListInProgress(true);
        SERVER.sendRequest({ call: APICall.streamManagerListStreams, args: [] }).then(
            (response) => {
                if (response){
                    response.forEach( (item:string, index:number) => {
                        describeStream(item, index); 
                    });
                }
                setRequestStreamsListInProgress(false);
            },
            (reason) => {
              console.log("Error in [StreamManager]: " + reason);
              setRequestStreamsListInProgress(false);
            }
        );
    }

    const onClickRefresh = () => {
        listStreams();
    }

    const onClickDelete = () => {
        setViewConfirmDelete(true)
    }

    const onDismiss = () => {
        setViewConfirmDelete(false);
    }

    const confirmDelete = () => {
        if (selectedStream){
            deleteMessageStream(selectedStream[0].definition.name)
            setViewConfirmDelete(false);
            setSelectedStream([]);
        }
    }

    function OnPageIndexChangedHanlder (pageIndex:number) {
        setCurrentPageIndex(pageIndex);
    }

    const tabs: TabsProps.Tab[] = [
        {
            id: "tab1",
            label: "Streams",
            content: (
                <Table
                    empty={
                        <Box textAlign="center" color="inherit">
                            <b>No resources</b>
                            <Box
                                padding={{ bottom: "s" }}
                                variant="p"
                                color="inherit"
                            >
                                No resources to display.
                            </Box>
                        </Box>
                    }
                    filter={
                        <TextFilter
                            filteringPlaceholder="Find stream"
                            filteringText={filteringText}
                            onChange={({detail}) =>setFilteringText(detail.filteringText)}
                        />
                    }
                    selectionType="single"
                    trackBy="key"
                    loading={requestStreamsListInProgress}
                    selectedItems={selectedStream}
                    loadingText="Loading resources"
                    items={streamManagerStreamsList.slice((currentPageIndex-1)*(preferences.pageSize || 10),(currentPageIndex-1)*(preferences.pageSize || 10) + (preferences.pageSize || 10)).filter((s:Stream) => s.definition.name.toLowerCase().includes(filteringText.toLowerCase()))}
                    onSelectionChange={(e: any) => {
                        setSelectedStream(streamManagerStreamsList.filter((s:Stream) => s.definition.name === e.detail.selectedItems[0].definition.name))
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
                            onConfirm={({detail}) => setPreferences(detail)}
                        />
                    }
                header={
                    <Header
                        counter=
                        {
                            "(" + streamManagerStreamsList.length +")"
                        }

                    actions={            
                        <SpaceBetween direction="horizontal"  size="xs">
                            <Button     
                                onClick = {() => {
                                    onClickRefresh();
                                }}
                                iconName="refresh" 
                                wrapText={false}
                                disabled={requestStreamsListInProgress}
                            >
                                Refresh
                            </Button>
                            <Button     
                                onClick = {() => {
                                    onClickDelete();
                                }}
                                wrapText={false}
                                disabled={selectedStream?.length? false:true}
                            >
                                Delete
                            </Button>
                            <Modal
                                onDismiss={onDismiss}
                                visible={viewConfirmDelete}
                                size="medium"
                                footer={
                                    <Box float="right">
                                    <SpaceBetween direction="horizontal" size="xs">
                                        <Button variant="link" onClick={onDismiss}>Cancel</Button>
                                        <Button variant="primary" onClick={confirmDelete}>Delete</Button>
                                    </SpaceBetween>
                                    </Box>
                                }
                                header={selectedStream?.length? 'Delete ' + selectedStream[0].definition.name : ''}
                                >
                                Are you sure you want to delete the stream?
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
                        onPageIndexChanged={ (pageIndex:any) => OnPageIndexChangedHanlder(pageIndex)}
                    />
                }
                />
            ),
        },
        {
            id: "tab2",
                label: "Configuration",
                content: (
                    <ColumnLayout columns={4} variant="text-grid">
                        {items.map((group, index) => (
                            <SpaceBetween size="xs" key={index}>
                                {group.map((item) => (
                                    <div key={item.field}>
                                    <Box margin={{bottom: "xxxs"}} color="text-label">{item.field}</Box>
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
