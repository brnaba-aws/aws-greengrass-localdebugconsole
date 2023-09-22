import React from "react";
import {Modal, Box, Button, SpaceBetween} from "@cloudscape-design/components";

interface DeleteModalProps {
    header: string,
    onDismiss: any;
    isVisible: boolean;
    confirmDelete: any;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
    header,
    onDismiss,
    isVisible,
    confirmDelete,
}) => {

  return (
    <Modal
        onDismiss={onDismiss}
        visible={isVisible}
        size="medium"
        footer={
            <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                    <Button
                        variant="link"
                        onClick={onDismiss}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={confirmDelete}
                    >
                        Delete
                    </Button>
                </SpaceBetween>
            </Box>
        }
        header={header}
    >
        Are you sure you want to delete the stream?
    </Modal>
  );
};

export default DeleteModal;
