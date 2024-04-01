import React, { useRef } from "react";
import { InputNumber } from "antd";

export default function CustomNumber(props) {
  const {
    // show,
    style,
    value,
    afterblur,
    onChange,
    durationmax,
    config: { min, formatType },
  } = props;

  const formatMap = {
    date: {
      formatter: dateFormat,
      parser: dateParser,
    },
  };

  const inputref = useRef();

  function handleChange(val) {
    onChange(val);
    afterblur(val);
  }

  function dateFormat(number) {
    return `${number} 天`;
  }

  function dateParser(str) {
    if (!str) return;
    const num = str.slice(0, -2);
    return Number(num);
  }

  return (
    <InputNumber
      {...props}
      inputref={inputref}
      style={style}
      value={value}
      onChange={handleChange}
      min={min}
      max={durationmax}
      formatter={formatMap[formatType]?.formatter}
      parser={formatMap[formatType]?.parser}
      // onBlur={handleBlur}
    />
  );
}
