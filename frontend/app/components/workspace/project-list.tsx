import { type TaskStatus, type Project } from "@/types";
import { ProjectCard } from "../project/project-card";
import { NoDataFound } from "../no-data-found";

interface ProjectListProps {
  workspaceId: string;
  projects: Project[];

  onCreateProject: () => void;
}

export const ProjectList = ({
  workspaceId,
  projects,
  onCreateProject,
}: ProjectListProps) => {
  const calculateProgress = (project: Project) => {
    if (project.tasks.length === 0) return 0;

    const completedTasks = project.tasks.filter(
      (task) => task.status === "Done",
    ).length;

    return Math.round((completedTasks / project.tasks.length) * 100);
  };

  return (
    <div>
      <h3 className="text-xl font-medium mb-4">Projects</h3>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.length === 0 ? (
          <NoDataFound
            title="No projects found"
            description="Create a project to get started"
            buttonText="Create Project"
            buttonAction={onCreateProject}
          />
        ) : (
          projects.map((project) => {
            project.progress = calculateProgress(project);

            return (
              <ProjectCard
                key={project._id}
                project={project}
                progress={project.progress}
                workspaceId={workspaceId}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
