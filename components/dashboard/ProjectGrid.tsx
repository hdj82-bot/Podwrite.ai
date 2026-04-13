import ProjectCard from './ProjectCard'
import type { Project, Plan } from '@/types'

interface ProjectGridProps {
  projects: Project[]
  plan?: Plan
}

export default function ProjectGrid({ projects, plan = 'free' }: ProjectGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} plan={plan} />
      ))}
    </div>
  )
}
