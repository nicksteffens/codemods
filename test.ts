// test.tsx
import React from "react";
import { PhotoLibraryRounded } from "@mui/icons-material";

// type MyProps = {
//   name: string;
//   age: number;
// };

function TestComponent({ name, age }: { name: string; age: number }) {
  return (
    <div>
      Hello, {name}! You are {age} years old.
    </div>
  );
}

export default TestComponent;
