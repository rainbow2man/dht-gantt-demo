import React from "react";
import { InputNumber, Slider, Row, Col } from "antd";

export default function CustomSlider(props) {
  const {
    // show,
    value,
    onChange,
  } = props;

  return (
    <Row>
      <Col span={17}>
        <Slider
          {...props}
          min={0}
          max={1}
          onChange={onChange}
          value={value}
          step={0.01}
          open={false}
          formatter={(val) => `${(val * 100).toFixed(0)}%`}
          // onBlur={handleBlur}
        />
      </Col>
      <Col span={6} style={{ marginLeft: -3 }}>
        <InputNumber
          min={0}
          max={1}
          style={{ margin: "0 16px" }}
          step={0.01}
          value={value}
          onChange={onChange}
          formatter={(num) => {
            return `${(num * 100).toFixed(0)}%`;
          }}
          parser={(str) => {
            if (!str) return;
            const num = str.slice(0, -1);
            return Number(num / 100);
          }}
        />
      </Col>
    </Row>
  );
}
