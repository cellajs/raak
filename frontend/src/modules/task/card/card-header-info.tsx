import { InfoIcon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/modules/ui/popover';
import { dateShort } from '~/utils/date-short';

// This component can show history info later on
const TaskCardHeaderInfo = ({ task }: { task: Task }) => {
  const [open, setOpen] = useState(false);

  const user = task.updatedBy;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            onClick={() => setOpen(true)}
            aria-label="InfoIcon"
            variant="ghost"
            className="cursor-pointer text-secondary-foreground/50 hover:text-secondary-foreground"
            size="xs"
          />
        }
      >
        <InfoIcon size={16} />
      </PopoverTrigger>
      <PopoverContent
        className="flex flex-col gap-2 font-normal text-muted-foreground text-sm sm:w-80"
        align="start"
        side="top"
      >
        <div className="flex items-center">
          <PencilIcon size={14} className="mr-3 opacity-70" />
          {user && (
            <EntityAvatar
              type="user"
              className="mr-2 h-5 w-5 text-xs"
              id={user.id}
              name={user.name}
              url={user.thumbnailUrl}
            />
          )}
          {dateShort(task.updatedAt)}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { TaskCardHeaderInfo };
