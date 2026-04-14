export const Colors = {
  primary:    "#1a5c2a",
  primaryDk:  "#145222",
  primaryLt:  "#e8f5e9",
  secondary:  "#2e7d32",
  accent:     "#4caf50",
  bg:         "#f5f8f5",
  white:      "#ffffff",
  text:       "#1a2a1a",
  textMuted:  "#6b7c6b",
  border:     "#d0dcd0",
  danger:     "#d32f2f",
  warning:    "#f57c00",
  info:       "#1565c0",
  success:    "#2e7d32",

  disease: {
    Leaf_Algal:          "#e8f5e9",
    Leaf_Blight:         "#fff3e0",
    Leaf_Colletotrichum: "#f3e5f5",
    Leaf_Healthy:        "#e3f2fd",
    Leaf_Phomopsis:      "#fce4ec",
    Leaf_Rhizoctonia:    "#fbe9e7",
  },

  diseaseBadge: {
    Leaf_Algal:          { bg: "#e8f5e9", text: "#2e7d32" },
    Leaf_Blight:         { bg: "#fff3e0", text: "#e65100" },
    Leaf_Colletotrichum: { bg: "#f3e5f5", text: "#6a1b9a" },
    Leaf_Healthy:        { bg: "#e3f2fd", text: "#1565c0" },
    Leaf_Phomopsis:      { bg: "#fce4ec", text: "#c62828" },
    Leaf_Rhizoctonia:    { bg: "#fbe9e7", text: "#bf360c" },
  },
} as const;
