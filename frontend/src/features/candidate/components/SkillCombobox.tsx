import * as React from 'react';
import { Search, X, Plus, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSkillCatalog, updateMyProfile } from '../api';
import type { CandidateProfile, SkillCatalogItem } from '@/api/types';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { getApiErrorDetails } from '@/shared/lib/api-error';

export function SkillCombobox({ profile }: { profile?: CandidateProfile }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const skills = profile?.skills ?? [];
  const existingSkillIds = React.useMemo(
    () => new Set(skills.map((s) => s.skillId)),
    [skills]
  );

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Query skills from canonical catalog
  const { data: catalogItems = [], isLoading: isLoadingCatalog } = useQuery({
    queryKey: ['skills-catalog', search],
    queryFn: () => getSkillCatalog(search),
    enabled: isOpen || search.trim().length > 0,
    staleTime: 60_000,
  });

  // Filter out skills already added to candidate profile
  const availableSkills = React.useMemo(() => {
    return catalogItems.filter((item) => !existingSkillIds.has(item.id));
  }, [catalogItems, existingSkillIds]);

  // Mutation to add a skill from the catalog
  const addMutation = useMutation({
    mutationFn: (skillItem: SkillCatalogItem) => {
      if (!profile) throw new Error('Profile not loaded');
      const currentSkills = profile.skills.map((s) => ({
        skillId: s.skillId,
        yearsOfExperience: s.yearsOfExperience,
      }));
      return updateMyProfile({
        expectedVersion: profile.version,
        skills: [...currentSkills, { skillId: skillItem.id, yearsOfExperience: null }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] });
      setSearch('');
      setIsOpen(false);
    },
  });

  // Mutation to remove a skill
  const removeMutation = useMutation({
    mutationFn: (removedSkillId: string) => {
      if (!profile) throw new Error('Profile not loaded');
      return updateMyProfile({
        expectedVersion: profile.version,
        skills: profile.skills
          .filter((skill) => skill.skillId !== removedSkillId)
          .map((skill) => ({
            skillId: skill.skillId,
            yearsOfExperience: skill.yearsOfExperience,
          })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-profile'] });
    },
  });

  const mutationError = addMutation.error || removeMutation.error;
  const isPending = addMutation.isPending || removeMutation.isPending;

  return (
    <div className="space-y-4" ref={containerRef}>
      {mutationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{getApiErrorDetails(mutationError).message}</AlertDescription>
        </Alert>
      )}

      {/* Existing Skills Badges */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-2">
          Kỹ năng hiện tại ({skills.length})
        </label>
        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <Badge
                key={skill.skillId}
                variant="outline"
                className="flex items-center gap-1.5 border-action/20 bg-action/5 px-3 py-1.5 text-sm text-action font-medium rounded-lg"
              >
                <span>{skill.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${skill.name}`}
                  onClick={() => removeMutation.mutate(skill.skillId)}
                  disabled={isPending}
                  className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-action/10 hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate italic">Chưa có kỹ năng nào được thêm vào hồ sơ.</p>
        )}
      </div>

      {/* Search and Add Skill from Catalog */}
      <div className="relative pt-2">
        <label htmlFor="skill-search-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 mb-2">
          Thêm kỹ năng từ danh mục
        </label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            id="skill-search-input"
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Tìm kiếm kỹ năng (ví dụ: React, TypeScript, Java, Docker...)"
            disabled={isPending}
            className="pl-10 pr-10 rounded-xl"
          />
          {isLoadingCatalog ? (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
          ) : search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Dropdown Suggestions */}
        {isOpen && (
          <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-border bg-surface shadow-lg max-h-60 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-150">
            {isLoadingCatalog && availableSkills.length === 0 ? (
              <div className="flex items-center justify-center p-4 text-sm text-ink-muted gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang tải danh mục kỹ năng…</span>
              </div>
            ) : availableSkills.length > 0 ? (
              <ul role="listbox" className="space-y-0.5">
                {availableSkills.map((item) => (
                  <li key={item.id} role="option" aria-selected="false">
                    <button
                      type="button"
                      onClick={() => addMutation.mutate(item)}
                      disabled={isPending}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-raised transition-colors flex items-center justify-between text-sm group"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-action opacity-70 group-hover:opacity-100" />
                        <span className="font-medium text-ink">{item.name}</span>
                        {item.aliases && item.aliases.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({item.aliases.join(', ')})
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-action flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="h-3.5 w-3.5" />
                        Thêm
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {search.trim() ? (
                  <p>Không tìm thấy kỹ năng phù hợp với "{search}".</p>
                ) : (
                  <p>Nhập từ khóa để tìm kiếm kỹ năng.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
