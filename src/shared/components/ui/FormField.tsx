import type { ReactNode } from "react";

export interface FormFieldProps {
	id?: string;
	label: string;
	error?: string;
	help?: string;
	required?: boolean;
	children: ReactNode;
	className?: string;
}

export function FormField({
	id,
	label,
	error,
	help,
	required,
	children,
	className = "",
}: FormFieldProps) {
	return (
		<div className={`flex flex-col gap-1 ${className}`}>
			<label htmlFor={id} className="text-sm font-medium text-foreground">
				{label}
				{required && <span className="text-destructive ml-1">*</span>}
			</label>
			{children}
			{error ? (
				<span role="alert" className="text-xs text-destructive">
					{error}
				</span>
			) : (
				help && <span className="text-xs text-muted-foreground">{help}</span>
			)}
		</div>
	);
}
