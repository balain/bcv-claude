import { RELATION_LABELS } from '../../lib/wordStudy/settings';
import type { Visibility } from '../../lib/wordStudy/types';
export function RelationshipControls({ value, onChange }: {
    value: Visibility;
    onChange: (v: Visibility) => void;
}) {
    return <fieldset className="ws-visibility"><legend>Related word details</legend>
    <button type="button" onClick={() => onChange(Object.fromEntries(Object.keys(value).map(k => [k, !Object.values(value).every(Boolean)])) as Visibility)}>{Object.values(value).every(Boolean) ? 'Hide all' : 'Show all'}</button>
    {Object.entries(RELATION_LABELS).map(([key, label]) => <label key={key}><input type="checkbox" checked={value[key as keyof Visibility]} onChange={e => onChange({ ...value, [key]: e.target.checked })}/>{label}</label>)}
  </fieldset>;
}
