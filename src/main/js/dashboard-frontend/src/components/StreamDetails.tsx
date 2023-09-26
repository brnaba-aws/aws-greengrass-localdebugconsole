import React, {useContext, useEffect, useReducer, useRef, useState} from "react";
import {
    Box,
    Button,
    ButtonDropdown,
    CollectionPreferences,
    CollectionPreferencesProps,
    ColumnLayout,
    Container,
    ContentLayout,
    Form,
    FormField,
    Header,
    Input,
    Modal,
    Select,
    SpaceBetween,
    StatusIndicator,
    Table,
    TableProps,
    Textarea,
    TextFilter,
} from "@cloudscape-design/components";
import model1 from "../static/streammanagerModel.json"
import {RouteComponentProps, useHistory, withRouter} from "react-router-dom";
import {
    formatBytes,
    getElapsedTime,
    getExportType,
    Message,
    Persistence,
    StrategyOnFull,
    Stream,
    StreamManagerReducer,
} from "../util/StreamManagerUtils";
import {DefaultContext, SERVER} from "../index";
import {APICall} from "../util/CommUtils";
import {STREAM_MANAGER_ROUTE_HREF_PREFIX} from "../util/constNames";
import PaginationRendering from "../util/PaginationRendering";
import StreamExportDefinition from "./details/StreamExportDefinition"
import StreamManagerResponseMessage from "../util/StreamManagerResponseMessage";
import DeleteModal from "./StreamManagerDeleteModal";
import createPersistedState from "use-persisted-state";

const model = model1.definitions;

interface StreamManagerProps extends RouteComponentProps {
}

const useMessagesTablePreferences = createPersistedState<CollectionPreferencesProps.Preferences>("gg.streamManager.streamDetailsPreferencesMessages");
const useDetailsPreferences = createPersistedState<CollectionPreferencesProps.Preferences>("gg.streamManager.streamDetailsPreferences");

const StreamDetail: React.FC<StreamManagerProps> = () => {

    const [messagesList, setMessagesList] = useState<Message[]>([])
    const [streamDetails, setStreamDetails] = useState<Stream>();
    const [messageCount, setMessageCount] = useState(0);
    const [currentPageIndex, setCurrentPageIndex] = useState(1)
    const previousPageIndex = useRef(currentPageIndex);
    const [readMessagesStreamRequestInProgress, setReadMessageStreamRequestInProgress] = useState(false);
    const [appendMessageRequest, setAppendMessageRequest] = useState(false);
    const [filteringText, setFilteringText] = useState("");
    const [viewAppendMessage, setViewAppendMessage] = useState(false);
    const [viewUpdateDefinition, setViewUpdateDefinition] = useState(false);
    const [viewDelete, setViewDeleteStream] = useState(false);
    const [messageToAppend, setMessageToAppend] = useState("");
    const defaultContext = useContext(DefaultContext);
    const [updateStreamErrorText, setUpdateStreamErrorText] = useState("");
    let history = useHistory();
    let streamName = history.location.pathname.substring(STREAM_MANAGER_ROUTE_HREF_PREFIX.length - 1);
    const [updateStream, dispatch] = useReducer(StreamManagerReducer, {
        name: "",
        maxSize: model.MessageStreamDefinition.properties.maxSize.minimum,
        streamSegmentSize: model.MessageStreamDefinition.properties.streamSegmentSize.minimum,
        strategyOnFull: StrategyOnFull.RejectNewData,
        persistence: Persistence.File,
        flushOnWrite: false,
        exportDefinition: Object.keys(model.ExportDefinition.properties).reduce((prev: any, id) => {
            prev[id] = [];
            return prev;
        }, {})
    });
    const columnDefinitionsMessages: TableProps.ColumnDefinition<Message>[] = [
        {
            id: "sequenceNumber",
            header: "Sequence number",
            cell: (e: Message) => e.sequenceNumber
        },
        {
            id: "message",
            header: "Message",
            cell: (e: Message) => atob(e.payload?.toString() || '')
        },
        {
            id: "ingestTime",
            header: "Message ingested",
            cell: (e: Message) => new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            }).format(e.ingestTime || 0)
        },
    ];

    const columnDefinitionsExportStatuses: TableProps.ColumnDefinition<any>[] = [
        {
            id: "exportConfigIdentifier",
            header: "Identifier",
            cell: (e: any) => e.exportConfigIdentifier
        },
        {
            id: "export Type",
            header: "Export type",
            cell: (e: any) => getExportType(e.exportConfigIdentifier, streamDetails)
        },
        {
            id: "lastExportedSequenceNumber",
            header: "Last exported sequence number",
            cell: (e: any) => e.lastExportedSequenceNumber
        },
        {
            id: "lastExportTime",
            header: "Last exported date",
            cell: (e: any) => (
                getElapsedTime(e.lastExportTime).toString()
            )
        },
        {
            id: "exportedMessagesCount",
            header: "Total exported messages",
            cell: (e: any) => e.exportedMessagesCount
        },
        {
            id: "exportedBytesFromStream",
            header: "Total exported bytes",
            cell: (e: any) => formatBytes(e.exportedBytesFromStream)
        },
        {
            id: "errorMessage",
            header: "Last error",
            cell: (e: any) => <StatusIndicator
                type={e.errorMessage ? "error" : 'success'}>{e.errorMessage || 'None'}</StatusIndicator>
        }
    ];

    const [preferencesMessages, setPreferencesMessages] = useMessagesTablePreferences({
        pageSize: 100,
        visibleContent: ["sequenceNumber", "message", "ingestTime"]
    });
    const [preferenceStreamDetailsPage, setPreferenceStreamDetailsPage] = useDetailsPreferences({
        visibleContent: ["details", "messages", "exportDefinitions", "exportStatuses"]
    });

    const items = [
        [
            {
                field: "Stream segment size",
                value: formatBytes(streamDetails?.messageStreamInfo.definition.streamSegmentSize),
            },
            {
                field: "Max size",
                value: formatBytes(streamDetails?.messageStreamInfo.definition.maxSize),
            },
            {
                field: "Total size",
                value: formatBytes(streamDetails?.messageStreamInfo.storageStatus.totalBytes),
            },
        ],
        [
            {
                field: "Persistence",
                value: (model.Persistence.javaEnumNames[streamDetails?.messageStreamInfo.definition.persistence || 0])
            },
            {
                field: "Strategy",
                value: (model.StrategyOnFull.javaEnumNames[streamDetails?.messageStreamInfo.definition.strategyOnFull || 0]),
            },
            {
                field: "Flush on write",
                value: (streamDetails?.messageStreamInfo.definition.flushOnWrite + ""),
            },
        ],
        [
            {
                field: "Newest sequence number",
                value: (streamDetails?.messageStreamInfo.storageStatus.newestSequenceNumber)
            },
            {
                field: "Oldest sequence number",
                value: (streamDetails?.messageStreamInfo.storageStatus.oldestSequenceNumber),
            },
            {
                field: "TTL on message",
                value: (streamDetails?.messageStreamInfo.definition.timeToLiveMillis),
            },
        ]
    ];

    function OnPageIndexChangedHandler(pageIndex: number) {
        setCurrentPageIndex(pageIndex);
    }

    const onClickRefresh = () => {
        describeStream(streamName, 0);
    }

    const describeStreamCallback = (streamName: string) => {
        describeStream(streamName, 0);
    }

    const onItemClick = (id: string) => {
        switch (id) {
            case 'am':
                setViewAppendMessage(true);
                dispatch({
                    type: 'set_all', payload: {
                        name: streamDetails?.messageStreamInfo.definition.name,
                        maxSize: streamDetails?.messageStreamInfo.definition.maxSize,
                        streamSegmentSize: streamDetails?.messageStreamInfo.definition.streamSegmentSize,
                        timeToLiveMillis: streamDetails?.messageStreamInfo.definition.timeToLiveMillis,
                        strategyOnFull: streamDetails?.messageStreamInfo.definition.strategyOnFull,
                        persistence: streamDetails?.messageStreamInfo.definition.persistence,
                        flushOnWrite: streamDetails?.messageStreamInfo.definition.flushOnWrite,
                        exportDefinition: streamDetails?.messageStreamInfo.definition.exportDefinition
                    }, callbackError: setUpdateStreamErrorText
                });
                break;
            case 'ud':
                setViewUpdateDefinition(true);
                dispatch({
                    type: 'set_all', payload: {
                        name: streamDetails?.messageStreamInfo.definition.name,
                        maxSize: streamDetails?.messageStreamInfo.definition.maxSize,
                        streamSegmentSize: streamDetails?.messageStreamInfo.definition.streamSegmentSize,
                        timeToLiveMillis: streamDetails?.messageStreamInfo.definition.timeToLiveMillis,
                        strategyOnFull: streamDetails?.messageStreamInfo.definition.strategyOnFull,
                        persistence: streamDetails?.messageStreamInfo.definition.persistence,
                        flushOnWrite: streamDetails?.messageStreamInfo.definition.flushOnWrite,
                        exportDefinition: streamDetails?.messageStreamInfo.definition.exportDefinition
                    }, callbackError: setUpdateStreamErrorText
                });
                break;
            case 'ds':
                setViewDeleteStream(true);
                break;
        }
    }

    const onClickAppend = () => {
        setViewAppendMessage(true);
    }

    async function describeStream(streamName: string, index: number) {
        const response: StreamManagerResponseMessage = await SERVER.sendRequest({
            call: APICall.streamManagerDescribeStream,
            args: [streamName]
        });
        if (response && response.successful && response.messageStreamInfo) {
            const item: Stream = {
                key: index,
                messageStreamInfo: response.messageStreamInfo
            };
            setStreamDetails(item);
            setMessageCount(item.messageStreamInfo.storageStatus.newestSequenceNumber - item.messageStreamInfo.storageStatus.oldestSequenceNumber + 1);
            readMessages(streamName, item.messageStreamInfo.storageStatus.newestSequenceNumber);
        }
    }

    async function readMessages(streamName: string, desiredStartSequenceNumber: number) {
        setReadMessageStreamRequestInProgress(true);
        setMessagesList([]);

        try {
            if (desiredStartSequenceNumber >= 0) {
                if (desiredStartSequenceNumber - (preferencesMessages.pageSize || 100) * (currentPageIndex - 1) >= (preferencesMessages.pageSize || 100)) {
                    const response: StreamManagerResponseMessage = await SERVER.sendRequest({
                        call: APICall.streamManagerReadMessages,
                        args: [streamName, desiredStartSequenceNumber - (preferencesMessages.pageSize || 100) * (currentPageIndex) + 1, 1, (preferencesMessages.pageSize || 100), 5000]
                    });

                    if (response && response.successful && response.messagesList) {
                        const listMessageDescending: Message[] = response.messagesList;
                        listMessageDescending.sort((a: any, b: any) => b.sequenceNumber - a.sequenceNumber);
                        setMessagesList(listMessageDescending);
                    }
                } else {
                    const response: StreamManagerResponseMessage = await SERVER.sendRequest({
                        call: APICall.streamManagerReadMessages,
                        args: [streamName, 0, 1, desiredStartSequenceNumber - (preferencesMessages.pageSize || 100) * (currentPageIndex - 1) + 1, 5000]
                    });
                    if (response && response.successful && response.messagesList) {
                        const listMessageDescending: Message[] = response.messagesList.sort((a: any, b: any) => b.sequenceNumber - a.sequenceNumber);
                        setMessagesList(listMessageDescending);
                    }
                }
            }
        } finally {
            setReadMessageStreamRequestInProgress(false);
        }
    }

    const onDismiss = () => {
        setViewAppendMessage(false);
        setMessageToAppend("");
        setViewUpdateDefinition(false)
        setViewDeleteStream(false);
    }

    const confirmDeleteStream = async () => {
        const response: StreamManagerResponseMessage = await SERVER.sendRequest({
            call: APICall.streamManagerDeleteMessageStream,
            args: [streamName]
        });
        if (response) {
            defaultContext.addFlashItem!({
                type: response.successful ? 'success' : 'error',
                header: response.successful ? `${streamName} has been deleted` : `Failed to delete ${streamName}`,
                content: response.errorMsg
            });
            if (response.successful) {
                history.push(`${STREAM_MANAGER_ROUTE_HREF_PREFIX.substring(1)}`);
            }
        }
        setViewDeleteStream(false);
    };

    const appendMessageClick = async () => {
        setAppendMessageRequest(true);
        const response: StreamManagerResponseMessage = await SERVER.sendRequest({
            call: APICall.streamManagerAppendMessage,
            args: [streamName, messageToAppend]
        });
        if (response) {
            setAppendMessageRequest(false);
            defaultContext.addFlashItem!({
                type: response.successful ? 'success' : 'error',
                header: response.successful ? `Message has been added to ${streamName}` : `Failed to add the message to ${streamName}`,
                content: response.errorMsg
            });
            describeStream(streamName, 0);
            setViewAppendMessage(false);
        }
    }

    const onClickUpdate = async () => {
        if (streamDetails) {
            const response: StreamManagerResponseMessage = await SERVER.sendRequest({
                call: APICall.streamManagerUpdateMessageStream,
                args: [JSON.stringify(updateStream)]
            });
            if (response) {
                defaultContext.addFlashItem!({
                    type: response.successful ? 'success' : 'error',
                    header: response.successful ? `${streamName} has been updated` : `Failed to update ${streamName}`,
                    content: response.errorMsg
                });
                describeStream(streamName, 0);
            }
            setViewUpdateDefinition(false)
        }
    }

    useEffect(() => {
        if (previousPageIndex.current !== currentPageIndex) {
            readMessages(streamName, streamDetails?.messageStreamInfo.storageStatus.newestSequenceNumber || 0);
            previousPageIndex.current = currentPageIndex;
        } else {
            describeStream(streamName, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPageIndex]);

    return (
        <ContentLayout
            header={
                <Header
                    variant={"h1"}
                    actions={
                        <SpaceBetween direction="horizontal"
                                      size="xs">
                            <Button
                                onClick={onClickRefresh}
                                iconName="refresh"
                                wrapText={false}
                                disabled={readMessagesStreamRequestInProgress}
                            >
                            </Button>
                            <ButtonDropdown
                                disabled={readMessagesStreamRequestInProgress}
                                items={[
                                    {text: "Update definition", id: "ud", disabled: false},
                                    {text: "Add message", id: "am", disabled: false},
                                    {text: "Delete stream", id: "ds", disabled: false},
                                ]}
                                onItemClick={(e) => onItemClick(e.detail.id)}
                            >
                                Actions
                            </ButtonDropdown>
                            <CollectionPreferences
                                visibleContentPreference={{
                                    title: "Visible items",
                                    options: [{
                                        label: "", options: [
                                            {editable: true, label: "Stream details", id: "details"},
                                            {editable: true, label: "Export statuses", id: "exportStatuses"},
                                            {
                                                editable: true,
                                                label: "Export definitions",
                                                id: "exportDefinitions"
                                            },
                                            {editable: true, label: "Messages", id: "messages"},
                                        ]
                                    }]
                                }}
                                title={"Preferences"}
                                confirmLabel={"Ok"}
                                cancelLabel={"Cancel"}
                                preferences={preferenceStreamDetailsPage}
                                onConfirm={({detail}) => {
                                    setPreferenceStreamDetailsPage(detail);
                                }}
                            />
                        </SpaceBetween>
                    }
                >
                    {streamName}
                </Header>
            }
        >
            <SpaceBetween direction="vertical" size="l">
                {
                    (preferenceStreamDetailsPage.visibleContent?.some((e: string) => e === "details") !== false) &&
                    <Container>
                        <SpaceBetween direction="vertical" size="l">
                            <Header>Stream definition</Header>
                            <ColumnLayout columns={items.length} variant="text-grid">
                                {items.map((group, index) => (
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
                        </SpaceBetween>
                    </Container>
                }
                {
                    (preferenceStreamDetailsPage.visibleContent?.some((e: string) => e === "exportDefinitions") !== false) &&
                    <Container variant="default">
                        {streamDetails &&
                            <StreamExportDefinition streamProps={streamDetails}
                                                    loadingFlagProps={false}
                                                    describeStreamCallbackPros={describeStreamCallback}
                            >
                            </StreamExportDefinition>
                        }

                    </Container>
                }
                {
                    (preferenceStreamDetailsPage.visibleContent?.some((e: string) => e === "exportStatuses") !== false) &&
                    <Table
                        columnDefinitions={columnDefinitionsExportStatuses}
                        sortingDisabled
                        loadingText="Loading export statuses."
                        wrapLines={true}
                        items={streamDetails?.messageStreamInfo.exportStatuses || []}
                        empty={
                            <Box
                                margin={{vertical: "xs"}}
                                textAlign="center"
                                color="inherit"
                            >
                                <SpaceBetween size="m">
                                    <b>No exported statuses.</b>
                                </SpaceBetween>
                            </Box>
                        }
                        header={
                            <Header
                                counter=
                                    {
                                        `(${streamDetails?.messageStreamInfo.exportStatuses.length || 0})`
                                    }
                            >
                                Export statuses
                            </Header>
                        }
                    ></Table>
                }
                {
                    (preferenceStreamDetailsPage.visibleContent?.some((e: string) => e === "messages") !== false) &&
                    <Table
                        empty={
                            <Box textAlign="center" color="inherit">
                                <b>No messages</b>
                                <Box
                                    padding={{bottom: "s"}}
                                    variant="p"
                                    color="inherit"
                                >
                                    <Button
                                        onClick={onClickAppend}
                                        iconName="add-plus"
                                        wrapText={false}
                                        disabled={appendMessageRequest}
                                    >
                                        Add Message
                                    </Button>
                                </Box>
                            </Box>
                        }
                        trackBy="sequenceNumber"
                        loading={readMessagesStreamRequestInProgress}
                        wrapLines={true}
                        loadingText="Loading messages"
                        items={messagesList.filter((m: Message) => atob(m.payload?.toString() || '').includes(filteringText.toLowerCase())).slice(0, preferencesMessages.pageSize || 100)}
                        filter={
                            <TextFilter
                                filteringPlaceholder="Find message(s)"
                                filteringText={filteringText}
                                onChange={({detail}) => setFilteringText(detail.filteringText)}
                            />
                        }
                        columnDefinitions={columnDefinitionsMessages}
                        visibleColumns={preferencesMessages.visibleContent}
                        preferences={
                            <CollectionPreferences
                                visibleContentPreference={{
                                    title: "Visible columns",
                                    options: [{
                                        label: "", options: [
                                            {editable: false, label: "sequenceNumber", id: "sequenceNumber"},
                                            {editable: true, label: "message", id: "message"},
                                            {editable: true, label: "ingestTime", id: "ingestTime"},
                                        ]
                                    }]
                                }}
                                pageSizePreference={{
                                    title: "Page size",
                                    options: [
                                        {value: 10, label: "10"},
                                        {value: 50, label: "50"},
                                        {value: 100, label: "100"}]
                                }}
                                title={"Preferences"}
                                confirmLabel={"Ok"}
                                cancelLabel={"Cancel"}
                                preferences={preferencesMessages}
                                onConfirm={({detail}) => {
                                    setPreferencesMessages(detail);
                                }}
                            />
                        }
                        header={
                            <Header
                                counter={`(${messageCount})`}
                                actions={
                                    <SpaceBetween direction="horizontal" size="xs">
                                        {messageCount > 0 && <Button
                                            onClick={onClickAppend}
                                            iconName="add-plus"
                                            wrapText={false}
                                            disabled={appendMessageRequest || readMessagesStreamRequestInProgress}
                                        >
                                            Add Message
                                        </Button>}
                                        <Modal
                                            onDismiss={onDismiss}
                                            visible={viewAppendMessage}
                                            size="medium"
                                            footer={
                                                <Box float="right">
                                                    <SpaceBetween direction="horizontal"
                                                                  size="xs">
                                                        <Button
                                                            variant="link"
                                                            onClick={onDismiss}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            variant="primary"
                                                            onClick={appendMessageClick}
                                                        >
                                                            Add
                                                        </Button>
                                                    </SpaceBetween>
                                                </Box>
                                            }
                                            header={`Add message to ${streamName}`}
                                        >
                                            <Form
                                                variant="embedded"
                                                header={<Header variant="h1"></Header>}
                                            >
                                                <Textarea
                                                    onChange={({detail}) => {
                                                        setMessageToAppend(detail.value)
                                                    }}
                                                    value={messageToAppend}
                                                    autoFocus
                                                    disabled={false}
                                                    placeholder="Enter the message here..."
                                                />
                                            </Form>
                                        </Modal>
                                    </SpaceBetween>
                                }
                            >
                                Messages
                            </Header>
                        }
                        pagination={
                            <PaginationRendering
                                numberOfItems={(streamDetails?.messageStreamInfo.storageStatus.newestSequenceNumber || 0) - (streamDetails?.messageStreamInfo.storageStatus.oldestSequenceNumber || 0) + 1}
                                numberOfItemPerPage={preferencesMessages.pageSize || 1}
                                pageIndex={currentPageIndex}
                                onPageIndexChanged={(pageIndex: any) => OnPageIndexChangedHandler(pageIndex)}
                            />
                        }
                    />
                }
            </SpaceBetween>
            <Modal
                onDismiss={onDismiss}
                visible={viewUpdateDefinition}
                size="medium"
                header={`Update ${streamName} definition`}
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
                                disabled={updateStreamErrorText.length !== 0}
                                variant="primary"
                                onClick={onClickUpdate}
                            >
                                Update
                            </Button>
                        </SpaceBetween>
                    }
                    errorText={updateStreamErrorText !== '' ? updateStreamErrorText : false}
                >
                    <SpaceBetween direction="vertical" size="l">
                        <FormField
                            label="Stream Name"
                            constraintText={model.MessageStreamDefinition.properties.name.description}
                        >
                            <Input
                                value={updateStream.name || ''}
                                disabled={true}
                            />
                        </FormField>
                        <FormField
                            label="Stream max size (in bytes)"
                            constraintText={model.MessageStreamDefinition.properties.maxSize.description}
                        >
                            <Input
                                value={updateStream.maxSize.toString() || ''}
                                onChange={(event) => dispatch({
                                    type: 'set_maxSize',
                                    payload: event.detail.value,
                                    callbackError: setUpdateStreamErrorText
                                })}
                                disabled={false}
                                step={1024}
                                inputMode="decimal"
                                type="number"
                            />
                        </FormField>
                        <FormField
                            constraintText={model.MessageStreamDefinition.properties.streamSegmentSize.description}
                            label="Stream segment size (in bytes)"
                        >
                            <Input
                                value={updateStream.streamSegmentSize.toString() || ''}
                                onChange={(event) => dispatch({
                                    type: 'set_streamSegmentSize',
                                    payload: event.detail.value,
                                    callbackError: setUpdateStreamErrorText
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
                                value={updateStream.timeToLiveMillis}
                                onChange={(event) => dispatch({
                                    type: 'set_streamTtl',
                                    payload: event.detail.value,
                                    callbackError: setUpdateStreamErrorText
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
                                selectedOption={updateStream.strategyOnFull === StrategyOnFull.OverwriteOldestData ? {
                                    label: "OverwriteOldestData",
                                    value: "1"
                                } : {label: "RejectNewData", value: "0"}}
                                onChange={({detail}) => dispatch({
                                    type: 'set_strategyOnFull',
                                    payload: detail.selectedOption.value,
                                    callbackError: setUpdateStreamErrorText
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
                                selectedOption={updateStream.persistence === Persistence.File ? {
                                    label: "File",
                                    value: "0"
                                } : {label: "Memory", value: "1"}}
                                onChange={({detail}) => dispatch({
                                    type: 'set_persistence',
                                    payload: detail.selectedOption.value,
                                    callbackError: setUpdateStreamErrorText
                                })}
                                disabled={false}
                            />
                        </FormField>
                        {updateStream.persistence === Persistence.File && <FormField
                            label="Flush on write"
                            constraintText={model.MessageStreamDefinition.properties.flushOnWrite.description}
                        >
                            <Select
                                options={[
                                    {label: "True", value: "0"},
                                    {label: "False", value: "1"}
                                ]}
                                selectedOption={updateStream.flushOnWrite === true ? {
                                    label: "True",
                                    value: "0"
                                } : {label: "False", value: "1"}}
                                onChange={({detail}) => dispatch({
                                    type: 'set_flushOnWrite',
                                    payload: detail.selectedOption.value,
                                    callbackError: setUpdateStreamErrorText
                                })}
                                disabled={false}
                            />
                        </FormField>}
                    </SpaceBetween>
                </Form>
            </Modal>
            <DeleteModal isVisible={viewDelete} header={`Delete ${streamName}`} onDismiss={onDismiss}
                         confirmDelete={confirmDeleteStream}/>
        </ContentLayout>
    );
}

export default withRouter(StreamDetail);
