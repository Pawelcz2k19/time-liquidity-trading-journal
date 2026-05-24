import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  testIdPrefix?: string;
  variant?: "default" | "destructive" | "secondary";
}

export function TagInput({ value, onChange, suggestions = [], placeholder = "Add tag...", testIdPrefix = "tag", variant = "secondary" }: Props) {
  const [text, setText] = useState("");

  const add = (t: string) => {
    const cleaned = t.trim();
    if (!cleaned) return;
    if (value.includes(cleaned)) return;
    onChange([...value, cleaned]);
    setText("");
  };
  const remove = (t: string) => onChange(value.filter(v => v !== t));

  const remainingSuggestions = suggestions.filter(s => !value.includes(s));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(t => (
            <Badge key={t} variant={variant} className="gap-1 pr-1" data-testid={`${testIdPrefix}-chip-${t}`}>
              {t}
              <button
                type="button"
                onClick={() => remove(t)}
                className="rounded-sm hover:bg-foreground/10 p-0.5"
                data-testid={`${testIdPrefix}-remove-${t}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); add(text); }
            if (e.key === "Backspace" && !text && value.length) remove(value[value.length - 1]);
          }}
          placeholder={placeholder}
          data-testid={`${testIdPrefix}-input`}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => add(text)} data-testid={`${testIdPrefix}-add`}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {remainingSuggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-card hover-elevate text-muted-foreground"
              data-testid={`${testIdPrefix}-suggestion-${s}`}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
