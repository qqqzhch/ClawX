/**
 * Skills Page
 * Browse and manage AI skills
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search,
  Puzzle,
  Lock,
  Package,
  X,
  AlertCircle,
  Plus,
  Save,
  Key,
  ChevronDown,
  Trash2,
  ChevronRight,
  RefreshCw,
  FolderOpen,
  FileCode,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSkillsStore } from '@/stores/skills';
import { useGatewayStore } from '@/stores/gateway';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { trackUiEvent } from '@/lib/telemetry';
import { toast } from 'sonner';
import type { Skill } from '@/types/skill';
import { useTranslation } from 'react-i18next';




// Skill detail dialog component
interface SkillDetailDialogProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
}

function SkillDetailDialog({ skill, isOpen, onClose, onToggle }: SkillDetailDialogProps) {
  const { t } = useTranslation('skills');
  const { fetchSkills } = useSkillsStore();
  const [activeTab, setActiveTab] = useState('info');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [apiKey, setApiKey] = useState('');
  const [isEnvExpanded, setIsEnvExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize config from skill
  useEffect(() => {
    if (!skill) return;
    
    // API Key
    if (skill.config?.apiKey) {
      setApiKey(String(skill.config.apiKey));
    } else {
      setApiKey('');
    }

    // Env Vars
    if (skill.config?.env) {
      const vars = Object.entries(skill.config.env).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      setEnvVars(vars);
    } else {
      setEnvVars([]);
    }
  }, [skill]);

  const handleOpenClawhub = async () => {
    if (!skill?.slug) return;
    await invokeIpc('shell:openExternal', `https://clawhub.ai/s/${skill.slug}`);
  };

  const handleOpenEditor = async () => {
    if (!skill?.slug) return;
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/open-readme', {
        method: 'POST',
        body: JSON.stringify({ slug: skill.slug }),
      });
        if (result.success) {
          toast.success(t('toast.openedEditor'));
        } else {
          toast.error(result.error || t('toast.failedEditor'));
        }
      } catch (err) {
        toast.error(t('toast.failedEditor') + ': ' + String(err));
      }
  };

  const handleAddEnv = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleUpdateEnv = (index: number, field: 'key' | 'value', value: string) => {
    const newVars = [...envVars];
    newVars[index] = { ...newVars[index], [field]: value };
    setEnvVars(newVars);
  };

  const handleRemoveEnv = (index: number) => {
    const newVars = [...envVars];
    newVars.splice(index, 1);
    setEnvVars(newVars);
  };

  const handleSaveConfig = async () => {
    if (isSaving || !skill) return;
    setIsSaving(true);
    try {
      // Build env object, filtering out empty keys
      const envObj = envVars.reduce((acc, curr) => {
        const key = curr.key.trim();
        const value = curr.value.trim();
        if (key) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      // Use direct file access instead of Gateway RPC for reliability
      const result = await invokeIpc<{ success: boolean; error?: string }>(
        'skill:updateConfig',
        {
          skillKey: skill.id,
          apiKey: apiKey || '', // Empty string will delete the key
          env: envObj // Empty object will clear all env vars
        }
      ) as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      // Refresh skills from gateway to get updated config
      await fetchSkills();

      toast.success(t('detail.configSaved'));
    } catch (err) {
      toast.error(t('toast.failedSave') + ': ' + String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!skill) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[420px] p-0 flex flex-col border-l border-black/10 dark:border-white/10 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 shadow-2xl" side="right">
        <SheetHeader className="p-6 flex flex-col gap-5 border-b border-black/5 dark:border-white/5 pb-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-[14px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 shrink-0 mt-0.5">
               <span className="text-2xl">{skill.icon || '🔧'}</span>
            </div>
            <div className="flex flex-col gap-1 w-full overflow-hidden min-w-0 pr-6">
              <SheetTitle className="flex items-center gap-2 text-lg font-semibold truncate leading-none pt-1">
                <span className="truncate">{skill.name}</span>
                {skill.isCore && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </SheetTitle>
              {skill.description && (
                <p className="text-[13px] text-muted-foreground leading-snug pr-2 mt-1">{skill.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {skill.slug && !skill.isBundled && !skill.isCore && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 gap-1.5 rounded-full border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none" onClick={handleOpenClawhub}>
                    <Globe className="h-3 w-3" />
                    ClawHub
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5 gap-1.5 rounded-full border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none" onClick={handleOpenEditor}>
                    <FileCode className="h-3 w-3" />
                    {t('detail.openManual')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 bg-transparent">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-2 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg p-1 h-auto">
              <TabsTrigger value="info" className="rounded-md py-1.5 text-xs">{t('detail.info')}</TabsTrigger>
              <TabsTrigger value="config" disabled={skill.isCore} className="rounded-md py-1.5 text-xs">{t('detail.config')}</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6 pt-5">
              <TabsContent value="info" className="mt-0 space-y-6">
                <div className="space-y-6 pr-2">

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">{t('detail.version')}</h3>
                      <p className="font-mono text-sm">{skill.version}</p>
                    </div>
                    {skill.author && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">{t('detail.author')}</h3>
                        <p className="text-sm">{skill.author}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">{t('detail.source')}</h3>
                    <Badge variant="secondary" className="mt-1 font-normal">
                      {skill.isCore ? t('detail.coreSystem') : skill.isBundled ? t('detail.bundled') : t('detail.userInstalled')}
                    </Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="config" className="mt-0 space-y-6">
                <div className="space-y-6">
                  {/* API Key Section */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      API Key
                    </h3>
                    <Input
                      placeholder={t('detail.apiKeyPlaceholder')}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      type="password"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('detail.apiKeyDesc')}
                    </p>
                  </div>

                  {/* Environment Variables Section */}
                  <div className="space-y-2 border rounded-md p-3">
                    <div className="flex items-center justify-between w-full">
                      <button
                        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                        onClick={() => setIsEnvExpanded(!isEnvExpanded)}
                      >
                        {isEnvExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        Environment Variables
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-5">
                          {envVars.length}
                        </Badge>
                      </button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEnvExpanded(true);
                          handleAddEnv();
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        {t('detail.addVariable')}
                      </Button>
                    </div>

                    {isEnvExpanded && (
                      <div className="pt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        {envVars.length === 0 && (
                          <p className="text-xs text-muted-foreground italic h-8 flex items-center">
                            {t('detail.noEnvVars')}
                          </p>
                        )}

                        {envVars.map((env, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={env.key}
                              onChange={(e) => handleUpdateEnv(index, 'key', e.target.value)}
                              className="flex-1 font-mono text-xs bg-muted/20"
                              placeholder={t('detail.keyPlaceholder')}
                            />
                            <span className="text-muted-foreground ml-1 mr-1">=</span>
                            <Input
                              value={env.value}
                              onChange={(e) => handleUpdateEnv(index, 'value', e.target.value)}
                              className="flex-1 font-mono text-xs bg-muted/20"
                              placeholder={t('detail.valuePlaceholder')}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveEnv(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}

                        {envVars.length > 0 && (
                          <p className="text-[10px] text-muted-foreground italic px-1 pt-1">
                            {t('detail.envNote')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 pb-6 flex justify-end">
                  <Button onClick={handleSaveConfig} className="gap-2 h-9 text-xs px-4" disabled={isSaving}>
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? t('detail.saving') : t('detail.saveConfig')}
                  </Button>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        {/* Footer Area */}
        <div className="p-6 md:px-8 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 mt-auto flex justify-end shrink-0">
          <div className="flex items-center gap-2">
            <label 
              className="text-[12px] font-medium cursor-pointer text-muted-foreground select-none" 
              onClick={() => !skill.isCore && onToggle(!skill.enabled)}
            >
              {skill.enabled ? t('detail.enabled') : t('detail.disabled')}
            </label>
            <Switch
              checked={skill.enabled}
              onCheckedChange={() => onToggle(!skill.enabled)}
              disabled={skill.isCore}
              className="scale-90 data-[state=checked]:bg-primary m-0"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Skills() {
  const {
    skills,
    loading,
    error,
    fetchSkills,
    enableSkill,
    disableSkill,
    searchResults,
    searchSkills,
    installSkill,
    uninstallSkill,
    searching,
    searchError,
    installing
  } = useSkillsStore();
  const { t } = useTranslation('skills');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceQuery, setMarketplaceQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'built-in' | 'marketplace'>('all');
  const marketplaceDiscoveryAttemptedRef = useRef(false);

  const isGatewayRunning = gatewayStatus.state === 'running';
  const [showGatewayWarning, setShowGatewayWarning] = useState(false);

  // Debounce the gateway warning to avoid flickering during brief restarts (like skill toggles)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isGatewayRunning) {
      // Wait 1.5s before showing the warning
      timer = setTimeout(() => {
        setShowGatewayWarning(true);
      }, 1500);
    } else {
      // Use setTimeout to avoid synchronous setState in effect
      timer = setTimeout(() => {
        setShowGatewayWarning(false);
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [isGatewayRunning]);

  // Fetch skills on mount
  useEffect(() => {
    if (isGatewayRunning) {
      fetchSkills();
    }
  }, [fetchSkills, isGatewayRunning]);

  // Filter skills
  const filteredSkills = skills.filter((skill) => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesSource = true;
    if (selectedSource === 'built-in') {
      matchesSource = !!skill.isBundled;
    } else if (selectedSource === 'marketplace') {
      matchesSource = !skill.isBundled;
    }

    return matchesSearch && matchesSource;
  }).sort((a, b) => {
    // Enabled skills first
    if (a.enabled && !b.enabled) return -1;
    if (!a.enabled && b.enabled) return 1;
    // Then core/bundled
    if (a.isCore && !b.isCore) return -1;
    if (!a.isCore && b.isCore) return 1;
    // Finally alphabetical
    return a.name.localeCompare(b.name);
  });

  const sourceStats = {
    all: skills.length,
    builtIn: skills.filter(s => s.isBundled).length,
    marketplace: skills.filter(s => !s.isBundled).length,
  };

  const bulkToggleVisible = useCallback(async (enable: boolean) => {
    const candidates = filteredSkills.filter((skill) => !skill.isCore && skill.enabled !== enable);
    if (candidates.length === 0) {
      toast.info(enable ? t('toast.noBatchEnableTargets') : t('toast.noBatchDisableTargets'));
      return;
    }

    let succeeded = 0;
    for (const skill of candidates) {
      try {
        if (enable) {
          await enableSkill(skill.id);
        } else {
          await disableSkill(skill.id);
        }
        succeeded += 1;
      } catch {
        // Continue to next skill and report final summary.
      }
    }

    trackUiEvent('skills.batch_toggle', { enable, total: candidates.length, succeeded });
    if (succeeded === candidates.length) {
      toast.success(enable ? t('toast.batchEnabled', { count: succeeded }) : t('toast.batchDisabled', { count: succeeded }));
      return;
    }
    toast.warning(t('toast.batchPartial', { success: succeeded, total: candidates.length }));
  }, [disableSkill, enableSkill, filteredSkills, t]);

  // Handle toggle
  const handleToggle = useCallback(async (skillId: string, enable: boolean) => {
    try {
      if (enable) {
        await enableSkill(skillId);
        toast.success(t('toast.enabled'));
      } else {
        await disableSkill(skillId);
        toast.success(t('toast.disabled'));
      }
    } catch (err) {
      toast.error(String(err));
    }
  }, [enableSkill, disableSkill, t]);

  const hasInstalledSkills = skills.some(s => !s.isBundled);

  const handleOpenSkillsFolder = useCallback(async () => {
    try {
      const skillsDir = await invokeIpc<string>('openclaw:getSkillsDir');
      if (!skillsDir) {
        throw new Error('Skills directory not available');
      }
      const result = await invokeIpc<string>('shell:openPath', skillsDir);
      if (result) {
        // shell.openPath returns an error string if the path doesn't exist
        if (result.toLowerCase().includes('no such file') || result.toLowerCase().includes('not found') || result.toLowerCase().includes('failed to open')) {
          toast.error(t('toast.failedFolderNotFound'));
        } else {
          throw new Error(result);
        }
      }
    } catch (err) {
      toast.error(t('toast.failedOpenFolder') + ': ' + String(err));
    }
  }, [t]);

  const [skillsDirPath, setSkillsDirPath] = useState('~/.openclaw/skills');

  useEffect(() => {
    invokeIpc<string>('openclaw:getSkillsDir')
      .then((dir) => setSkillsDirPath(dir as string))
      .catch(console.error);
  }, []);


  // Auto-reset when query is cleared
  useEffect(() => {
    if (activeTab === 'marketplace' && marketplaceQuery === '' && marketplaceDiscoveryAttemptedRef.current) {
      searchSkills('');
    }
  }, [marketplaceQuery, activeTab, searchSkills]);

  // Handle install
  const handleInstall = useCallback(async (slug: string) => {
    try {
      await installSkill(slug);
      // Automatically enable after install
      // We need to find the skill id which is usually the slug
      await enableSkill(slug);
      toast.success(t('toast.installed'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (['installTimeoutError', 'installRateLimitError'].includes(errorMessage)) {
        toast.error(t(`toast.${errorMessage}`, { path: skillsDirPath }), { duration: 10000 });
      } else {
        toast.error(t('toast.failedInstall') + ': ' + errorMessage);
      }
    }
  }, [installSkill, enableSkill, t, skillsDirPath]);

  // Initial marketplace load (Discovery)
  useEffect(() => {
    if (activeTab !== 'marketplace') {
      return;
    }
    if (marketplaceQuery.trim()) {
      return;
    }
    if (searching) {
      return;
    }
    if (marketplaceDiscoveryAttemptedRef.current) {
      return;
    }
    marketplaceDiscoveryAttemptedRef.current = true;
    searchSkills('');
  }, [activeTab, marketplaceQuery, searching, searchSkills]);

  // Handle uninstall
  const handleUninstall = useCallback(async (slug: string) => {
    try {
      await uninstallSkill(slug);
      toast.success(t('toast.uninstalled'));
    } catch (err) {
      toast.error(t('toast.failedUninstall') + ': ' + String(err));
    }
  }, [uninstallSkill, t]);

  if (loading) {
    return (
      <div className="flex flex-col -m-6 dark:bg-background min-h-[calc(100vh-2.5rem)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col -m-6 dark:bg-background h-[calc(100vh-2.5rem)] overflow-hidden">
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full p-10 pt-16">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-6 shrink-0 gap-4">
          <div>
            <h1 className="text-5xl md:text-6xl font-serif text-foreground mb-3 font-normal tracking-tight" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
              {t('title') || 'Skills'}
            </h1>
            <p className="text-[17px] text-foreground/80 font-medium">
              {t('subtitle') || 'Browse and manage AI capabilities.'}
            </p>
          </div>
          
          <div className="flex items-center gap-3 md:mt-2">
            {hasInstalledSkills && (
              <button 
                onClick={handleOpenSkillsFolder} 
                className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 text-[13px] font-medium px-4 h-8 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center text-foreground/80 hover:text-foreground"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Skills Folder
              </button>
            )}
          </div>
        </div>

        {/* Gateway Warning */}
        {showGatewayWarning && (
          <div className="mb-6 p-4 rounded-xl border border-yellow-500/50 bg-yellow-500/10 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-yellow-700 dark:text-yellow-400 text-sm font-medium">
              {t('gatewayWarning')}
            </span>
          </div>
        )}

        {/* Sub Navigation and Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4 shrink-0 gap-4">
          <div className="flex items-center flex-wrap gap-4 text-[14px]">
            <div className="relative group flex items-center bg-black/5 dark:bg-white/5 rounded-full px-3 py-1.5 focus-within:bg-black/10 transition-colors border border-transparent focus-within:border-black/10 dark:focus-within:border-white/10 mr-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                placeholder={t('search')}
                value={activeTab === 'marketplace' ? marketplaceQuery : searchQuery}
                onChange={(e) => activeTab === 'marketplace' ? setMarketplaceQuery(e.target.value) : setSearchQuery(e.target.value)}
                className="ml-2 bg-transparent outline-none w-24 focus:w-40 md:focus:w-56 transition-all font-normal placeholder:text-foreground/50 text-[13px] text-foreground"
              />
              {((activeTab === 'marketplace' && marketplaceQuery) || (activeTab === 'all' && searchQuery)) && (
                <button
                  type="button"
                  onClick={() => activeTab === 'marketplace' ? setMarketplaceQuery('') : setSearchQuery('')}
                  className="text-foreground/50 hover:text-foreground shrink-0 ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-6">
              <button
                onClick={() => { setActiveTab('all'); setSelectedSource('all'); }}
                className={cn("font-medium transition-colors flex items-center gap-1.5", activeTab === 'all' && selectedSource === 'all' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                All Skills
                <span className="text-[12px] font-normal opacity-70">{sourceStats.all}</span>
              </button>
              <button
                onClick={() => { setActiveTab('all'); setSelectedSource('built-in'); }}
                className={cn("font-medium transition-colors flex items-center gap-1.5", activeTab === 'all' && selectedSource === 'built-in' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Built-in
                <span className="text-[12px] font-normal opacity-70">{sourceStats.builtIn}</span>
              </button>
              <button
                onClick={() => setActiveTab('marketplace')}
                className={cn("font-medium transition-colors flex items-center gap-1.5", activeTab === 'marketplace' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Marketplace
                <span className="text-[12px] font-normal opacity-70">{sourceStats.marketplace}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'all' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkToggleVisible(true)}
                  className="h-8 text-[13px] font-medium rounded-md px-3 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none"
                >
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkToggleVisible(false)}
                  className="h-8 text-[13px] font-medium rounded-md px-3 border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none"
                >
                  Disable All
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={fetchSkills}
              disabled={!isGatewayRunning}
              className="h-8 w-8 ml-1 rounded-md border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 shadow-none text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 pb-10 min-h-0 -mr-2">
          {error && activeTab === 'all' && (
            <div className="mb-4 p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>
                {['fetchTimeoutError', 'fetchRateLimitError', 'timeoutError', 'rateLimitError'].includes(error)
                  ? t(`toast.${error}`, { path: skillsDirPath })
                  : error}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1">
          {activeTab === 'all' && (
            filteredSkills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Puzzle className="h-10 w-10 mb-4 opacity-50" />
                <p>{searchQuery ? t('noSkillsSearch') : t('noSkillsAvailable')}</p>
              </div>
            ) : (
              filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  className="group flex flex-row items-center justify-between py-3.5 px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-black/5 dark:border-white/5 last:border-0"
                  onClick={() => setSelectedSkill(skill)}
                >
                  <div className="flex items-start gap-4 flex-1 overflow-hidden pr-4">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center text-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl overflow-hidden">
                      {skill.icon || '🧩'}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[15px] font-semibold text-foreground truncate">{skill.name}</h3>
                        {skill.isCore ? (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        ) : skill.isBundled ? (
                          <Puzzle className="h-3 w-3 text-blue-500/70" />
                        ) : null}
                      </div>
                      <p className="text-[13.5px] text-muted-foreground line-clamp-1 pr-6 leading-relaxed">
                        {skill.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0" onClick={e => e.stopPropagation()}>
                    {skill.version && (
                      <span className="text-[13px] font-mono text-muted-foreground">
                        v{skill.version}
                      </span>
                    )}
                    <Switch
                      checked={skill.enabled}
                      onCheckedChange={(checked) => handleToggle(skill.id, checked)}
                      disabled={skill.isCore}
                    />
                  </div>
                </div>
              ))
            )
          )}

          {activeTab === 'marketplace' && (
             <div className="flex flex-col gap-1 mt-2">
                {searchError && (
                  <div className="mb-4 p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span>
                      {['searchTimeoutError', 'searchRateLimitError', 'timeoutError', 'rateLimitError'].includes(searchError.replace('Error: ', ''))
                        ? t(`toast.${searchError.replace('Error: ', '')}`, { path: skillsDirPath })
                        : t('marketplace.searchError')}
                    </span>
                  </div>
                )}
                
                {activeTab === 'marketplace' && marketplaceQuery && searching && (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <LoadingSpinner size="lg" />
                    <p className="mt-4 text-sm">{t('marketplace.searching')}</p>
                  </div>
                )}

                {searchResults.length > 0 ? (
                  searchResults.map((skill) => {
                    const isInstalled = skills.some(s => s.id === skill.slug || s.name === skill.name);
                    const isInstallLoading = !!installing[skill.slug];
                    
                    return (
                      <div
                        key={skill.slug}
                        className="group flex flex-row items-center justify-between py-3.5 px-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-black/5 dark:border-white/5 last:border-0"
                        onClick={() => invokeIpc('shell:openExternal', `https://clawhub.ai/s/${skill.slug}`)}
                      >
                        <div className="flex items-start gap-4 flex-1 overflow-hidden pr-4">
                          <div className="h-10 w-10 shrink-0 flex items-center justify-center text-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl overflow-hidden">
                            📦
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-[15px] font-semibold text-foreground truncate">{skill.name}</h3>
                              {skill.author && (
                                <span className="text-xs text-muted-foreground">• {skill.author}</span>
                              )}
                            </div>
                            <p className="text-[13.5px] text-muted-foreground line-clamp-1 pr-6 leading-relaxed">
                              {skill.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0" onClick={e => e.stopPropagation()}>
                           {skill.version && (
                             <span className="text-[13px] font-mono text-muted-foreground mr-2">
                               v{skill.version}
                             </span>
                           )}
                           {isInstalled ? (
                             <Button
                               variant="destructive"
                               size="sm"
                               onClick={() => handleUninstall(skill.slug)}
                               disabled={isInstallLoading}
                               className="h-8 shadow-none"
                             >
                               {isInstallLoading ? <LoadingSpinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
                             </Button>
                           ) : (
                             <Button
                               variant="default"
                               size="sm"
                               onClick={() => handleInstall(skill.slug)}
                               disabled={isInstallLoading}
                               className="h-8 px-4 rounded-full shadow-none font-medium text-xs"
                             >
                               {isInstallLoading ? <LoadingSpinner size="sm" /> : t('marketplace.install', 'Install')}
                             </Button>
                           )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  !searching && marketplaceQuery && (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                      <Package className="h-10 w-10 mb-4 opacity-50" />
                      <p>{t('marketplace.noResults')}</p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Skill Detail Dialog */}
      <SkillDetailDialog
        skill={selectedSkill}
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onToggle={(enabled) => {
          if (!selectedSkill) return;
          handleToggle(selectedSkill.id, enabled);
          setSelectedSkill({ ...selectedSkill, enabled });
        }}
      />
    </div>
  );
}

export default Skills;
