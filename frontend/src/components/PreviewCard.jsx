import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, FileText, Plus, X } from 'lucide-react';

function Section({ title, children, defaultOpen = true, innerRef }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div ref = {innerRef} className="border border-gray-200 rounded-lg mb-4 transition-colors duration-500">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {open ? <ChevronDown className="h-5 w-5 text-gray-500"/> : <ChevronRight className="h-5 w-5 text-gray-500"/>}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

const PreviewCard = forwardRef(({ solution, editable = false, onChange }, ref) => {

  // Refs for chatbot navigation
  const sectionRefs = {
    'problem-statement': useRef(null),
    'key-challenges': useRef(null),
    'solution-approach': useRef(null),
    'architecture-diagram': useRef(null),
    'milestones': useRef(null),
    'technical-stack': useRef(null),
    'objectives': useRef(null),
    'acceptance-criteria': useRef(null),
    'resources': useRef(null),
    'cost-analysis': useRef(null),
    'key-performance-indicators': useRef(null),
  };

  // Expose scroll method to parent (App.js)
  useImperativeHandle(ref, () => ({
    scrollToSection: (sectionId) => {
      const section = sectionRefs[sectionId];
      if (section && section.current) {
        section.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        section.current.classList.add('bg-yellow-100');
        setTimeout(() => {
          section.current.classList.remove('bg-yellow-100');
        }, 1500);
      }
    },
  }));

  // Diagram fetch state and effect: if there is Mermaid code but no image, fetch SVG from Kroki
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState(null);

  useEffect(() => {
    if (!solution || !solution.architecture_diagram) return;
    // If an image is already present, nothing to do
    if (solution.architecture_diagram_image) return;

    let mounted = true;
    const controller = new AbortController();

    async function fetchSvg() {
      setDiagramError(null);
      setDiagramLoading(true);
      try {
        const src = solution.architecture_diagram;
        const resp = await fetch('https://kroki.io/mermaid/svg', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: src,
          signal: controller.signal
        });
        if (!resp.ok) {
          throw new Error(`Kroki returned ${resp.status}`);
        }
        const svgText = await resp.text();
        // Convert to base64 safely for unicode
        const b64 = window.btoa(unescape(encodeURIComponent(svgText)));
        const dataUri = `data:image/svg+xml;base64,${b64}`;
        if (!mounted) return;
        // Persist the generated image into solution via onChange
        updateField('architecture_diagram_image', dataUri);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Failed to fetch SVG from Kroki:', err);
        if (mounted) setDiagramError(err.message || String(err));
      } finally {
        if (mounted) setDiagramLoading(false);
      }
    }

    fetchSvg();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [solution?.architecture_diagram, solution?.architecture_diagram_image]);

  if (!solution) {
    return (
      <div className="text-center py-12">
        <FileText className="h-24 w-24 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Solution Generated Yet</h3>
        <p className="text-gray-500">Upload an RFP document and click "Generate Solution" to see the preview here.</p>
      </div>
    );
  }

  const updateField = (field, value) => {
    const updated = { ...solution, [field]: value };
    onChange?.(updated);
  };

  const updateListItem = (field, index, value) => {
    const list = [...(solution[field] || [])];
    list[index] = value;
    updateField(field, list);
  };

  const addListItem = (field, emptyValue) => {
    const list = [...(solution[field] || [])];
    list.push(emptyValue);
    updateField(field, list);
  };

  const removeListItem = (field, index) => {
    const list = [...(solution[field] || [])];
    list.splice(index, 1);
    updateField(field, list);
  };

  const updateApproachItem = (index, patch) => {
    const arr = [...(solution.solution_approach || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('solution_approach', arr);
  };

  const addApproachItem = () => {
    addListItem('solution_approach', { title: 'New Step', description: '' });
  };

  const removeApproachItem = (index) => {
    const arr = [...(solution.solution_approach || [])];
    arr.splice(index, 1);
    updateField('solution_approach', arr);
  };

  const updateMilestone = (index, patch) => {
    const arr = [...(solution.milestones || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('milestones', arr);
  };

  const addMilestone = () => {
    addListItem('milestones', { phase: 'New Phase', duration: '1 week', description: '' });
  };

  const removeMilestone = (index) => {
    const arr = [...(solution.milestones || [])];
    arr.splice(index, 1);
    updateField('milestones', arr);
  };

  // New: Resources helpers
  const updateResource = (index, patch) => {
    const arr = [...(solution.resources || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('resources', arr);
  };
  const addResource = () => addListItem('resources', { role: 'New Role', count: 1, years_of_experience: 3, responsibilities: '' });
  const removeResource = (index) => {
    const arr = [...(solution.resources || [])];
    arr.splice(index, 1);
    updateField('resources', arr);
  };

  // New: Cost Analysis helpers
  const updateCost = (index, patch) => {
    const arr = [...(solution.cost_analysis || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('cost_analysis', arr);
  };
  const addCost = () => addListItem('cost_analysis', { item: 'New Item', cost: '₹0', notes: '' });
  const removeCost = (index) => {
    const arr = [...(solution.cost_analysis || [])];
    arr.splice(index, 1);
    updateField('cost_analysis', arr);
  };

  // KPI helpers
  const updateKPI = (index, patch) => {
    const arr = [...(solution.key_performance_indicators || [])];
    arr[index] = { ...arr[index], ...patch };
    updateField('key_performance_indicators', arr);
  };
  const addKPI = () => addListItem('key_performance_indicators', { 
    metric: 'New KPI', 
    target: 'Target Value', 
    measurement_method: 'Measurement Method',
    frequency: 'Monthly'
  });
  const removeKPI = (index) => {
    const arr = [...(solution.key_performance_indicators || [])];
    arr.splice(index, 1);
    updateField('key_performance_indicators', arr);
  };

  return (
    <div className="space-y-6">
      <div className="border border-dashed border-gray-300 rounded-lg p-6">
        <div className="flex flex-col items-center text-center">
          <img src="/api/logo" alt="Company Logo" className="h-20 w-auto mb-4" />
          {editable ? (
            <input
              className="text-2xl font-bold text-center text-gray-900 mb-2 border-b border-gray-200 focus:outline-none focus:ring-0"
              value={solution.title}
              onChange={e => updateField('title', e.target.value)}
            />
          ) : (
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{solution.title}</h1>
          )}
          {editable ? (
            <input
              className="text-gray-600 text-center border-b border-gray-200 focus:outline-none focus:ring-0"
              value={solution.date}
              onChange={e => updateField('date', e.target.value)}
            />
          ) : (
            <p className="text-gray-600">{solution.date}</p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 my-4"></div>

      <Section title="Problem Statement" innerRef={sectionRefs['problem-statement']}>
        {editable ? (
          <textarea
            className="w-full bg-blue-50 p-4 rounded-lg text-gray-700 border border-blue-100 focus:outline-none focus:ring"
            rows={4}
            value={solution.problem_statement}
            onChange={e => updateField('problem_statement', e.target.value)}
          />
        ) : (
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-gray-700">{solution.problem_statement}</p>
          </div>
        )}
      </Section>

      {solution.key_challenges?.length > 0 && (
        <Section title="Key Challenges" innerRef={sectionRefs['key-challenges']}>
          {editable ? (
            <div className="space-y-2">
              {solution.key_challenges.map((challenge, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="flex-1 border rounded px-3 py-2 text-sm"
                    value={challenge}
                    onChange={e => updateListItem('key_challenges', idx, e.target.value)}
                  />
                  <button onClick={() => removeListItem('key_challenges', idx)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addListItem('key_challenges', '')} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add challenge
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {solution.key_challenges.map((challenge, idx) => (
                <div key={idx} className="flex items-start">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                  <p className="text-gray-700">{challenge}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {solution.solution_approach?.length > 0 && (
        <Section title="Our Solution Approach">
          {editable ? (
            <div className="space-y-4">
              {solution.solution_approach.map((step, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 font-semibold text-gray-900 mb-2 border-b focus:outline-none"
                      value={step.title}
                      onChange={e => updateApproachItem(index, { title: e.target.value })}
                    />
                    <button onClick={() => removeApproachItem(index)} className="p-2 text-red-600 hover:bg-red-50 rounded self-start">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    className="w-full text-gray-700 border rounded px-3 py-2"
                    rows={3}
                    value={step.description}
                    onChange={e => updateApproachItem(index, { description: e.target.value })}
                  />
                </div>
              ))}
              <button onClick={addApproachItem} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add step
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {solution.solution_approach.map((step, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{step.title}</h4>
                  <p className="text-gray-700">{step.description}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {solution.architecture_diagram && (
        <Section title="Architecture Diagram" innerRef={sectionRefs['architecture-diagram']}>
          <div className="border border-gray-200 rounded-lg p-4">
            {console.log('Architecture Data:', {
              diagram: solution.architecture_diagram?.substring(0, 100) + '...',
              image: solution.architecture_diagram_image?.substring(0, 100) + '...',
              hasImage: !!solution.architecture_diagram_image,
              imageType: typeof solution.architecture_diagram_image
            })}
            {editable ? (
              <textarea
                className="w-full text-gray-700 border rounded px-3 py-2"
                rows={5}
                value={solution.architecture_diagram}
                onChange={e => updateField('architecture_diagram', e.target.value)}
              />
            ) : (
              <div>
                {solution.architecture_diagram_image ? (
                  <div className="overflow-hidden">
                    <img 
                      src={solution.architecture_diagram_image} 
                      alt="Architecture Diagram" 
                      className="max-w-full h-auto mx-auto"
                      onError={(e) => {
                        console.error('Image failed to load:', e);
                        e.target.onerror = null; 
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'block';
                      }}
                      style={{maxHeight: '600px'}}
                    />
                    <div className="hidden">
                      <div className="text-amber-600 mb-4">
                        Failed to load diagram. Showing raw diagram code:
                      </div>
                      <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap break-all">
                        {solution.architecture_diagram}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-amber-600 mb-4">
                      Diagram visualization is not available. Showing raw diagram code:
                    </div>
                    <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap break-all">
                      {solution.architecture_diagram}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {solution.milestones?.length > 0 && (
        <Section title="Key Milestones">
          {editable ? (
            <div className="space-y-3">
              {solution.milestones.map((m, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input className="md:col-span-4 border rounded px-3 py-2 text-sm" value={m.phase} onChange={e => updateMilestone(idx, { phase: e.target.value })} />
                  <input className="md:col-span-2 border rounded px-3 py-2 text-sm" value={m.duration} onChange={e => updateMilestone(idx, { duration: e.target.value })} />
                  <textarea className="md:col-span-5 border rounded px-3 py-2 text-sm" rows={2} value={m.description} onChange={e => updateMilestone(idx, { description: e.target.value })} />
                  <button onClick={() => removeMilestone(idx)} className="md:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded justify-self-start md:justify-self-auto">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addMilestone} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add milestone
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Phase</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Duration</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.milestones.map((m, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{m.phase}</td>
                      <td className="px-4 py-2 border-b align-top">{m.duration}</td>
                      <td className="px-4 py-2 border-b align-top">{m.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {solution.technical_stack?.length > 0 && (
        <Section title="Technology Stack">
          {editable ? (
            <div className="space-y-2">
              {solution.technical_stack.map((tech, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 border rounded px-3 py-2 text-sm" value={tech} onChange={e => updateListItem('technical_stack', i, e.target.value)} />
                  <button onClick={() => removeListItem('technical_stack', i)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addListItem('technical_stack', '')} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add technology
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {solution.technical_stack.map((tech, index) => (
                <div key={index} className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-center text-sm font-medium">
                  {tech}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {solution.objectives?.length > 0 && (
        <Section title="Objectives" innerRef={sectionRefs['objectives']}>
          {editable ? (
            <div className="space-y-2">
              {solution.objectives.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 border rounded px-3 py-2 text-sm" value={o} onChange={e => updateListItem('objectives', i, e.target.value)} />
                  <button onClick={() => removeListItem('objectives', i)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addListItem('objectives', '')} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add objective
              </button>
            </div>
          ) : (
            <ul className="list-disc pl-6 text-gray-700">
              {solution.objectives.map((o, i) => <li key={i} className="mb-1">{o}</li>)}
            </ul>
          )}
        </Section>
      )}

      {solution.acceptance_criteria?.length > 0 && (
        <Section title="Acceptance Criteria">
          {editable ? (
            <div className="space-y-2">
              {solution.acceptance_criteria.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 border rounded px-3 py-2 text-sm" value={c} onChange={e => updateListItem('acceptance_criteria', i, e.target.value)} />
                  <button onClick={() => removeListItem('acceptance_criteria', i)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addListItem('acceptance_criteria', '')} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add criteria
              </button>
            </div>
          ) : (
            <ul className="list-disc pl-6 text-gray-700">
              {solution.acceptance_criteria.map((c, i) => <li key={i} className="mb-1">{c}</li>)}
            </ul>
          )}
        </Section>
      )}

      {solution.resources?.length > 0 && (
        <Section title="Resources" innerRef={sectionRefs['resources']}>
          {editable ? (
            <div className="space-y-3">
              {solution.resources.map((r, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input className="md:col-span-3 border rounded px-3 py-2 text-sm" value={r.role} onChange={e => updateResource(i, { role: e.target.value })} />
                  <input className="md:col-span-2 border rounded px-3 py-2 text-sm" type="number" min={0} value={r.count} onChange={e => updateResource(i, { count: Number(e.target.value) })} />
                  <input className="md:col-span-2 border rounded px-3 py-2 text-sm" type="number" min={0} value={r.years_of_experience || 0} onChange={e => updateResource(i, { years_of_experience: Number(e.target.value) })} />
                  <textarea className="md:col-span-4 border rounded px-3 py-2 text-sm" rows={2} value={r.responsibilities || ''} onChange={e => updateResource(i, { responsibilities: e.target.value })} />
                  <button onClick={() => removeResource(i)} className="md:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addResource} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add resource
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Role</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Count</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Years of Experience</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Responsibilities</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.resources.map((r, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{r.role}</td>
                      <td className="px-4 py-2 border-b align-top">{r.count}</td>
                      <td className="px-4 py-2 border-b align-top">{r.years_of_experience}</td>
                      <td className="px-4 py-2 border-b align-top">{r.responsibilities}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {solution.cost_analysis?.length > 0 && (
        <Section title="Cost Analysis" innerRef={sectionRefs['cost-analysis']}>
          {editable ? (
            <div className="space-y-3">
              {solution.cost_analysis.map((c, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input className="md:col-span-5 border rounded px-3 py-2 text-sm" value={c.item} onChange={e => updateCost(i, { item: e.target.value })} />
                  <input className="md:col-span-2 border rounded px-3 py-2 text-sm" value={c.cost} onChange={e => updateCost(i, { cost: e.target.value })} />
                  <textarea className="md:col-span-4 border rounded px-3 py-2 text-sm" rows={2} value={c.notes || ''} onChange={e => updateCost(i, { notes: e.target.value })} />
                  <button onClick={() => removeCost(i)} className="md:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addCost} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add cost item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Item</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Cost (INR)</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.cost_analysis.map((c, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{c.item}</td>
                      <td className="px-4 py-2 border-b align-top">{c.cost}</td>
                      <td className="px-4 py-2 border-b align-top">{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* Key Performance Indicators */}
      {solution.key_performance_indicators?.length > 0 && (
        <Section title="Key Performance Indicators" innerRef={sectionRefs['key-performance-indicators']}>
          {editable ? (
            <div className="space-y-3">
              {solution.key_performance_indicators.map((kpi, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input 
                    className="md:col-span-3 border rounded px-3 py-2 text-sm" 
                    value={kpi.metric} 
                    onChange={e => updateKPI(i, { metric: e.target.value })} 
                    placeholder="Metric"
                  />
                  <input 
                    className="md:col-span-2 border rounded px-3 py-2 text-sm" 
                    value={kpi.target} 
                    onChange={e => updateKPI(i, { target: e.target.value })} 
                    placeholder="Target"
                  />
                  <input 
                    className="md:col-span-3 border rounded px-3 py-2 text-sm" 
                    value={kpi.measurement_method} 
                    onChange={e => updateKPI(i, { measurement_method: e.target.value })} 
                    placeholder="Measurement Method"
                  />
                  <input 
                    className="md:col-span-3 border rounded px-3 py-2 text-sm" 
                    value={kpi.frequency || ''} 
                    onChange={e => updateKPI(i, { frequency: e.target.value })} 
                    placeholder="Frequency"
                  />
                  <button onClick={() => removeKPI(i)} className="md:col-span-1 p-2 text-red-600 hover:bg-red-50 rounded">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addKPI} className="text-blue-600 text-sm inline-flex items-center">
                <Plus className="h-4 w-4 mr-1"/> Add KPI
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Metric</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Target</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Measurement Method</th>
                    <th className="px-4 py-2 text-sm font-semibold text-gray-700 border-b">Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.key_performance_indicators.map((kpi, i) => (
                    <tr key={i} className="odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 border-b align-top">{kpi.metric}</td>
                      <td className="px-4 py-2 border-b align-top">{kpi.target}</td>
                      <td className="px-4 py-2 border-b align-top">{kpi.measurement_method}</td>
                      <td className="px-4 py-2 border-b align-top">{kpi.frequency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
});
export default PreviewCard;