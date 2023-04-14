/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useCallback, useContext, useRef, useState} from "react";
import {withRouter} from "react-router-dom";

import {
    Box,
    Button, CollectionPreferences, CollectionPreferencesProps,
    Container,
    ContentLayout,
    Form,
    FormField,
    Grid,
    Header,
    Icon,
    Input,
    Link, Pagination, Select, SelectProps,
    SpaceBetween,
    Table,
    Tabs, TabsProps,
    Textarea,
} from "@cloudscape-design/components";

import {DefaultContext, SERVER} from "../index";
import {APICall} from "../util/CommUtils";
import {CommunicationMessage} from "../util/CommunicationMessage";
import {useCollection} from "@cloudscape-design/collection-hooks";

interface Message {
    binaryPayload: string;
    received: Date;
    topic: string;
}

const PubSub = () => {
    const [selectedTopic, setSelectedTopic] = useState("");
    const [subscribeTopicInputValue, setSubscribeTopicInputValue] = useState("");
    const [publishTopicInputValue, setPublishTopicInputValue] = useState("");
    const [messageInputValue, setMessageInputValue] = useState("");
    const [topicsAndMessages, setTopicsAndMessages] = useState<{ [key: string]: Message[] }>({});
    const [subscriptions, setSubscriptions] = useState<{subId: string, topic: string, source: string}[]>([]);

    const pubsubSelection = {
        value: "pubsub",
        label: "Local PubSub"
    };
    const [subscribeSourceValue, setSubscribeSourceValue] = useState<SelectProps.Option>(pubsubSelection);
    const [publishDestinationValue, setPublishDestinationValue] = useState<SelectProps.Option>(pubsubSelection);
    const topicsAndMessagesRef = useRef<typeof topicsAndMessages>();
    const defaultContext = useContext(DefaultContext);
    topicsAndMessagesRef.current = topicsAndMessages

    const handleNewMessage = useCallback((message: CommunicationMessage) => {
        const messageList = topicsAndMessagesRef.current?.[message.subId] || [];
        messageList.push({binaryPayload: message.payload, received: new Date(), topic: message.topic});
        setTopicsAndMessages((old) => ({
            ...old,
            [message.subId]: messageList,
        }));
    }, [topicsAndMessagesRef]);

    const onSubscribeTopicSubmit = async () => {
        const topic = subscribeTopicInputValue;
        const subId = subscribeSourceValue.value + topic;
        if (subId in topicsAndMessages) {
            return;
        }

        const result: unknown = await SERVER.sendSubscriptionMessage(
            {
                call: APICall.subscribeToPubSubTopic, args: [{
                    subId,
                    topicFilter: topic,
                    source: subscribeSourceValue.value
                }]
            },
            handleNewMessage
        );

        if (typeof result === "string") {
            defaultContext.addFlashItem!({
                type: 'error',
                header: 'Failed to subscribe',
                content: result,
            });
        } else {
            subscriptions.push({topic, subId, source: subscribeSourceValue.value!});
            setSubscriptions(subscriptions);
            setSelectedTopic(subId);
            setTopicsAndMessages((old) => ({
                ...old,
                [subId]: []
            }));
        }
    }

    const unsubscribeFromTopic = (subId: string) => {
        if (!(subId in topicsAndMessages)) {
            return;
        }

        delete topicsAndMessages[subId];
        const topics = Object.keys(topicsAndMessages);
        let newTopic = "";
        if (topics.length !== 0) {
            newTopic = topics[0];
        }
        setSubscriptions(subscriptions.filter(s => s.subId !== subId));
        setSelectedTopic(selectedTopic === subId ? newTopic : subId);
        setTopicsAndMessages({...topicsAndMessages});
        SERVER.sendSubscriptionMessage(
            {call: APICall.unsubscribeToPubSubTopic, args: [subId]},
            handleNewMessage
        );
    }

    const tabs: TabsProps.Tab[] = [
        {
            id: "tab1",
            label: "Subscribe",
            content: (
                <Form
                    actions={
                        <Button variant="primary" onClick={onSubscribeTopicSubmit}>Subscribe</Button>
                    }
                >
                    <SpaceBetween direction="vertical" size="l">
                        <FormField label="Topic filter"
                                   secondaryControl={<Select selectedOption={subscribeSourceValue}
                                                             options={[
                                                                 pubsubSelection,
                                                                 {value: "iotcore", label: "IoT Core"}]}
                                                             onChange={(e) => setSubscribeSourceValue(e.detail.selectedOption)}
                                   />}>
                            <Input
                                placeholder="Topic filter"
                                value={subscribeTopicInputValue}
                                onChange={event =>
                                    setSubscribeTopicInputValue(event.detail.value)
                                }
                            />
                        </FormField>
                    </SpaceBetween>
                </Form>
            ),
        },
        {
            id: "tab2",
            label: "Publish",
            content: (
                <Form
                    actions={
                        <Button variant="primary" onClick={async () => {
                            const result: unknown = await SERVER.sendRequest({
                                call: APICall.publishToPubSubTopic,
                                args: [JSON.stringify({
                                    topic: publishTopicInputValue, payload: messageInputValue,
                                    destination: publishDestinationValue.value
                                })],
                            });

                            if (typeof result === "string") {
                                defaultContext.addFlashItem!({
                                    type: 'error',
                                    header: 'Failed to publish',
                                    content: result,
                                });
                            }
                        }}>Publish</Button>
                    }
                >
                    <SpaceBetween direction="vertical" size="l">
                        <FormField label="Topic" secondaryControl={
                            <Select selectedOption={publishDestinationValue}
                                    options={[
                                        pubsubSelection,
                                        {value: "iotcore", label: "IoT Core"}]}
                                    onChange={(e) => setPublishDestinationValue(e.detail.selectedOption)}
                            />
                        }>
                            <Input
                                value={publishTopicInputValue}
                                onChange={event =>
                                    setPublishTopicInputValue(event.detail.value)
                                }
                            />
                        </FormField>
                        <FormField label="Message payload">
                            <Textarea
                                value={messageInputValue}
                                onChange={event =>
                                    setMessageInputValue(event.detail.value)
                                }
                            />
                        </FormField>
                    </SpaceBetween>
                </Form>
            ),
        },
    ];

    const [preferences, setPreferences] = useState<CollectionPreferencesProps.Preferences>({
        pageSize: 100,
        visibleContent: ["topic", "date", "message"]
    });
    const {items, collectionProps, paginationProps} =
        useCollection(topicsAndMessages[selectedTopic]?.slice().reverse() || [],
            {
                pagination: {pageSize: preferences.pageSize},
                sorting: {
                    defaultState: {
                        sortingColumn: {
                            sortingField: "date",
                        },
                        isDescending: true
                    }
                },
            });

    return (
        <ContentLayout header={<Header variant={"h1"}>Messaging test client</Header>}>
            <SpaceBetween direction="vertical" size="l">
                <Container>
                    <Tabs tabs={tabs}></Tabs>
                </Container>
                <Container header={<Header variant="h2">Subscriptions</Header>}>
                    <Grid gridDefinition={[
                        {colspan: {default: 12, s: 4}},
                        {colspan: {default: 12, s: 8}},
                    ]}>
                        <Table
                            columnDefinitions={[
                                {
                                    id: "source",
                                    header: "Source",
                                    cell: (e) => e.source === "iotcore" ? "IoT" : "PubSub",
                                },
                                {
                                    id: "topic",
                                    header: "Topic",
                                    cell: (e) => e.topic,
                                    sortingField: "topic"
                                },
                                {
                                    id: "unsub",
                                    header: "",
                                    cell: (e) => {
                                        return <Link onFollow={() => {
                                            unsubscribeFromTopic(e.subId);
                                        }
                                        }><Icon variant={"warning"} name={"close"}/></Link>;
                                    },
                                },
                            ]}
                            onSelectionChange={(e: any) => {
                                setSelectedTopic(e.detail.selectedItems[0].subId);
                            }}
                            selectedItems={subscriptions.filter(v => v.subId === selectedTopic)}
                            items={subscriptions}
                            selectionType="single"
                            empty={
                                <Box textAlign="center" color="inherit">
                                    <b>No subscriptions</b>
                                </Box>
                            }
                            sortingDisabled={true}
                            wrapLines={true}
                        />
                        <Table
                            {...collectionProps}
                            resizableColumns={true}
                            wrapLines={true}
                            header={<Header
                                actions={<Button iconName={"close"} disabled={selectedTopic === ""} onClick={() => {
                                    setTopicsAndMessages(old => {
                                        return {...old, [selectedTopic]: []}
                                    });
                                }
                                }>Clear</Button>}/>}
                            columnDefinitions={[
                                {
                                    id: "date",
                                    header: "Receive time",
                                    cell: (m: Message) => {
                                        return m.received.toLocaleTimeString();
                                    },
                                    sortingField: "received",
                                    width: 100,
                                },
                                {
                                    id: "topic",
                                    header: "Topic",
                                    cell: (m) => {
                                        return m.topic;
                                    },
                                    sortingField: "topic",
                                    width: 100,
                                },
                                {
                                    id: "message",
                                    header: "Message",
                                    cell: (m) => {
                                        return <pre>{m.binaryPayload}</pre>
                                    },
                                },
                            ]}
                            items={items}
                            visibleColumns={preferences.visibleContent}
                            preferences={
                                <CollectionPreferences
                                    visibleContentPreference={{
                                        title: "Visible columns",
                                        options: [{
                                            label: "", options: [
                                                {editable: true, label: "Receive time", id: "date"},
                                                {editable: true, label: "Topic", id: "topic"},
                                                {editable: true, label: "Message", id: "message"},
                                            ]
                                        }]
                                    }}
                                    pageSizePreference={{
                                        title: "Page size",
                                        options: [
                                            {value: 50, label: "50"},
                                            {value: 100, label: "100"},
                                            {value: 1000, label: "1000"}]
                                    }}
                                    title={"Preferences"}
                                    confirmLabel={"Ok"}
                                    cancelLabel={"Cancel"}
                                    preferences={preferences}
                                    onConfirm={({detail}) => setPreferences(detail)}
                                />
                            }
                            pagination={<Pagination {...paginationProps} />}
                            empty={
                                <Box textAlign="center" color="inherit">
                                    <b>No messages</b>
                                </Box>
                            }
                        />
                    </Grid>
                </Container>
            </SpaceBetween>
        </ContentLayout>
    );
};

export default withRouter(PubSub);
