import { useEffect, useState } from "react";

function App() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const getProducts = async () => {
    const res = await fetch("http://localhost:5000/api/products");
    const data = await res.json();
    setProducts(data);
  };

  useEffect(() => {
    getProducts();
  }, []);

  const addProduct = async () => {
    if (!name || !price) {
      return;
    }

    await fetch("http://localhost:5000/api/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, price }),
    });

    setName("");
    setPrice("");
    getProducts();
  };

  const deleteProduct = async (id) => {
    await fetch(`http://localhost:5000/api/products/${id}`, {
      method: "DELETE",
    });

    getProducts();
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-4xl font-bold mb-10">Quản lý sản phẩm</h1>

      <div className="bg-zinc-900 p-5 rounded-xl mb-10 space-y-4">
        <input
          type="text"
          placeholder="Tên sản phẩm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 rounded bg-zinc-800"
        />

        <input
          type="number"
          placeholder="Giá sản phẩm"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full p-3 rounded bg-zinc-800"
        />

        <button
          onClick={addProduct}
          className="bg-cyan-500 px-5 py-3 rounded font-bold"
        >
          Thêm sản phẩm
        </button>
      </div>

      <div className="space-y-5">
        {products.length === 0 ? (
          <div className="text-zinc-400">Chưa có sản phẩm nào.</div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="bg-zinc-900 p-5 rounded-xl flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h2 className="text-2xl">{product.name}</h2>
                <p className="text-cyan-400">
                  {Number(product.price).toLocaleString()}đ
                </p>
              </div>
              <button
                onClick={() => deleteProduct(product.id)}
                className="bg-red-500 px-4 py-2 rounded"
              >
                Xóa
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
