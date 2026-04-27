import { useEffect, useRef } from "react";

export default function Editable({
                                     value,
                                     onChange,
                                     as: Tag = "div",
                                     className = "",
                                     placeholder = "Type here",
                                     multiline = false
                                 }) {
    const ref = useRef(null);

    useEffect(() => {
        if (ref.current && ref.current.innerText !== value) {
            ref.current.innerText = value || "";
        }
    }, [value]);

    return (
        <Tag
            ref={ref}
            className={`editable ${className}`}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={placeholder}
            spellCheck="true"
            onBlur={(event) => onChange(event.currentTarget.innerText)}
            onKeyDown={(event) => {
                if (!multiline && event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                }
            }}
        />
    );
}