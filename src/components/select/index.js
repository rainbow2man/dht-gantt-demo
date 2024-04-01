import React, { useRef } from "react";
import { Select } from "antd";

export default function CustomSelect(props) {
  const {
    // show,
    style,
    value,
    afterblur,
    onChange,
    config: { originField, options = [] },
  } = props;

  const inputref = useRef();

  function handleChange(val) {
    onChange(val);
    afterblur(val);
  }

  return (
    <Select
      {...props}
      options={options}
      inputref={inputref}
      style={style}
      value={value}
      onChange={handleChange}
      allowClear={originField === "pre_task"}
      // onBlur={handleBlur}
    />
  );
}
