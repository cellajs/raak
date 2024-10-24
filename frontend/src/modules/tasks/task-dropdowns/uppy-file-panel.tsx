import type { PartialBlock } from '@blocknote/core';
import { type FilePanelProps, useBlockNoteEditor } from '@blocknote/react';
import { useTranslation } from 'react-i18next';
import { createAttachment } from '~/api/attachments';
import { useMutation } from '~/hooks/use-mutations';
import UploadUppy from '~/modules/common/upload/upload-uppy';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/modules/ui/dialog';
import { UploadType } from '~/types/common';

const blockTypes = {
  image: {
    allowedFileTypes: ['image/*'],
    plugins: ['image-editor', 'screen-capture', 'webcam'],
  },
  video: {
    allowedFileTypes: ['video/*'],
    plugins: ['screen-capture', 'webcam'],
  },
  audio: {
    allowedFileTypes: ['audio/*'],
    plugins: ['audio', 'screen-capture', 'webcam'],
  },
  file: {
    allowedFileTypes: ['*/*'],
    plugins: ['screen-capture', 'webcam'],
  },
};

const UppyFilePanel =
  ({
    taskId,
    organizationId,
    projectId,
  }: {
    taskId: string;
    organizationId: string;
    projectId: string;
  }) =>
  (props: FilePanelProps) => {
    const { t } = useTranslation();
    const { block } = props;
    const editor = useBlockNoteEditor();
    const type = (block.type as keyof typeof blockTypes) || 'file';

    const { mutate } = useMutation({
      mutationKey: ['attachments', 'create'],
      mutationFn: createAttachment,
    });

    return (
      <Dialog defaultOpen onOpenChange={() => editor.filePanel?.closeMenu()}>
        <DialogContent className="md:max-w-xl">
          <DialogHeader>
            <DialogTitle className="h-6">{t(`common:upload_${type}`)}</DialogTitle>
          </DialogHeader>
          <UploadUppy
            isPublic={true}
            uploadType={UploadType.Personal}
            uppyOptions={{
              restrictions: {
                maxFileSize: 10 * 1024 * 1024, // 10MB
                maxNumberOfFiles: 1,
                allowedFileTypes: blockTypes[type].allowedFileTypes,
                minFileSize: null,
                maxTotalFileSize: 10 * 1024 * 1024, // 100MB
                minNumberOfFiles: null,
                requiredMetaFields: [],
              },
            }}
            plugins={blockTypes[type].plugins}
            imageMode="attachment"
            callback={async (result) => {
              for (const res of result) {
                mutate({
                  url: res.url,
                  size: String(res.file.size || 0),
                  contentType: res.file.type,
                  filename: res.file.name || 'unknown',
                  taskId,
                  organizationId,
                  projectId,
                });

                const updateData: PartialBlock = {
                  props: {
                    name: res.file.name,
                    url: res.url,
                  },
                };
                editor.updateBlock(block, updateData);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    );
  };

export default UppyFilePanel;
