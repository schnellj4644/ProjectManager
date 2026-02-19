import {
  useAddSubTaskMutation,
  useUpdateSubTaskMutation,
} from "@/hooks/use-task";
import type { Subtask } from "@/types";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "../ui/checkbox";
import { cn } from "@/lib/utils";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export const SubTaskDetails = ({
  subTasks,
  taskId,
}: {
  subTasks: Subtask[];
  taskId: string;
}) => {
  const [newSubTask, setNewSubTask] = useState("");
  const { mutate: addSubTask, isPending } = useAddSubTaskMutation();
  const { mutate: updateSubTask, isPending: isUpdating } =
    useUpdateSubTaskMutation();

  const handleToggleTask = (subTaskId: string, checked: boolean) => {
    updateSubTask(
      { taskId, subTaskId, completed: checked },
      {
        onSuccess: () => {
          toast.success("Subtask updated successfully");
        },
        onError: (error: any) => {
          const errorMessage = error.response.data.message;
          console.error(error);
          toast.error(errorMessage);
        },
      },
    );
  };

  const handleAddSubTask = () => {
    addSubTask(
      { taskId, title: newSubTask },
      {
        onSuccess: () => {
          setNewSubTask("");
          toast.success("Subtask added successfully");
        },
        onError: (error: any) => {
          const errorMessage = error.response.data.message;
          console.error(error);
          toast.error(errorMessage);
        },
      },
    );
  };

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-0">
        Subtasks
      </h3>
      <div className="space-y-2 mb-4">
        {subTasks.length > 0 ? (
          subTasks.map((subTask) => (
            <div key={subTask._id} className="flex items-center space-x-2">
              <Checkbox
                id={subTask._id}
                checked={subTask.completed}
                onCheckedChange={(checked) =>
                  handleToggleTask(subTask._id, !!checked)
                }
                disabled={isUpdating}
              />
              <label
                className={cn(
                  "text-sm",
                  subTask.completed ? "line-through text-muted-foreground" : "",
                )}
              >
                {subTask.title}
              </label>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">No subtasks</div>
        )}
      </div>
      <div className="flex">
        <Input
          placeholder="Add a subtask"
          value={newSubTask}
          onChange={(e) => setNewSubTask(e.target.value)}
          className="mr-1"
          disabled={isPending}
        />
        <Button
          onClick={handleAddSubTask}
          disabled={isPending || newSubTask.length === 0}
        >
          Add
        </Button>
      </div>
    </div>
  );
};
