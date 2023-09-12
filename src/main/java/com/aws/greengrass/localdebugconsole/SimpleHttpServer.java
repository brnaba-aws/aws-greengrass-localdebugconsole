/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* Started life from the blog http://www.seepingmatter.com/2016/03/30/a-simple-standalone-http-server-with-netty.html */

package com.aws.greengrass.localdebugconsole;

import com.aws.greengrass.config.Topic;
import com.aws.greengrass.config.Topics;
import com.aws.greengrass.dependency.ImplementsService;
import com.aws.greengrass.dependency.State;
import com.aws.greengrass.deployment.DeviceConfiguration;
import com.aws.greengrass.ipc.AuthenticationHandler;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.lifecyclemanager.PluginService;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.util.Coerce;
import com.aws.greengrass.util.Pair;
import com.aws.greengrass.util.Utils;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.ByteBufAllocator;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.ChannelOption;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.FullHttpResponse;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpHeaderValues;
import io.netty.handler.codec.http.HttpObjectAggregator;
import io.netty.handler.codec.http.HttpResponseStatus;
import io.netty.handler.codec.http.HttpServerCodec;
import io.netty.handler.codec.http.HttpUtil;
import io.netty.handler.codec.http.HttpVersion;
import io.netty.handler.ssl.SslContext;
import io.netty.handler.ssl.SslContextBuilder;
import org.bouncycastle.asn1.ASN1ObjectIdentifier;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.OperatorCreationException;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import software.amazon.awssdk.regions.Region;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.KeyStoreException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Security;
import java.security.UnrecoverableKeyException;
import java.security.cert.Certificate;
import java.security.cert.CertificateEncodingException;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.Base64;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.inject.Inject;
import javax.inject.Provider;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.SSLException;

import static com.aws.greengrass.componentmanager.KernelConfigResolver.CONFIGURATION_CONFIG_KEY;
import static com.aws.greengrass.ipc.AuthenticationHandler.SERVICE_UNIQUE_ID_KEY;
import static com.aws.greengrass.util.Utils.isEmpty;
import static io.netty.buffer.Unpooled.copiedBuffer;

/**
 * This is pretty much a grotesque hack to build a lightweight web server on top of netty.  It doesn't support servlets
 * at all, it has it's own, cheesy, servlet-esque interface: CZS.  TODO: think about doing this right. Netty is probably
 * overkill.
 */
@ImplementsService(name = SimpleHttpServer.AWS_GREENGRASS_DEBUG_SERVER, autostart = true)
public class SimpleHttpServer extends PluginService implements Authenticator {
    public static final String AWS_GREENGRASS_DEBUG_SERVER = "aws.greengrass.LocalDebugConsole";
    protected static final String CERT_FINGERPRINT_NAMESPACE = "_certificateFingerprint";
    protected static final String DEBUG_PASSWORD_NAMESPACE = "_debugPassword";
    protected static final String EXPIRATION_NAMESPACE = "expiration";
    protected static final String SHA_1_ALGORITHM = "SHA-1";
    protected static final String SHA_256_ALGORITHM = "SHA-256";
    protected static final String CERT_NAME = "cert";
    protected static final String PRIVATE_KEY_NAME = "private";
    private ChannelFuture channel;
    private EventLoopGroup primaryGroup;
    private EventLoopGroup secondaryGroup;
    private static final int DEFAULT_HTTP_PORT = 1441;
    private static final int DEFAULT_WEBSOCKET_PORT = 1442;
    private static final boolean DEFAULT_HTTPS_ENABLED = true;
    int port = DEFAULT_HTTP_PORT;

    private final Kernel kernel;
    private final DeviceConfiguration deviceConfig;

    private DashboardServer dashboardServer;
    int websocketPort = DEFAULT_WEBSOCKET_PORT;
    private String bindHostname = "localhost";
    private boolean httpsEnabled = DEFAULT_HTTPS_ENABLED;
    private SslContext context;
    private Provider<SSLEngine> engineProvider;
    private String streamManagerAuthToken;

    @Inject
    public SimpleHttpServer(Topics t, Kernel kernel, DeviceConfiguration deviceConfiguration) {
        super(t);
        this.kernel = kernel;
        this.deviceConfig = deviceConfiguration;
    }

    @Override
    public void postInject() {
        super.postInject();
        // Does not happen for built-in/plugin services so doing explicitly
        AuthenticationHandler.registerAuthenticationToken(this);
        streamManagerAuthToken = Coerce.toString(this.getPrivateConfig().findLeafChild(SERVICE_UNIQUE_ID_KEY));

        config.lookup(CONFIGURATION_CONFIG_KEY, "port").dflt(port).subscribe((w, n) -> {
            int oldPort = port;
            port = Coerce.toInt(n);
            if (port < 1024) {
                logger.atWarn().kv("port", port).kv("defaultPort", DEFAULT_HTTP_PORT)
                        .log("Port number should not be smaller than 1024. Using default.");
                port = DEFAULT_HTTP_PORT;
            }
            if (oldPort != port) {
                requestRestart();
            }
        });
        config.lookup(CONFIGURATION_CONFIG_KEY, "httpsEnabled").dflt(DEFAULT_HTTPS_ENABLED).subscribe((w, n) -> {
            boolean oldEnabled = httpsEnabled;
            httpsEnabled = Coerce.toBoolean(n);
            if (oldEnabled != httpsEnabled) {
                requestRestart();
            }
        });
        config.lookup(CONFIGURATION_CONFIG_KEY, "websocketPort").dflt(websocketPort).subscribe((w, n) -> {
            int oldPort = websocketPort;
            websocketPort = Coerce.toInt(n);
            if (websocketPort < 1024) {
                logger.atWarn().kv("websocketPort", websocketPort).kv("defaultWebsocketPort", DEFAULT_WEBSOCKET_PORT)
                        .log("Websocket port number should not be smaller than 1024. Using default.");
                websocketPort = DEFAULT_WEBSOCKET_PORT;
            }
            if (oldPort != websocketPort) {
                requestRestart();
            }
        });
        config.lookup(CONFIGURATION_CONFIG_KEY, "bindHostname").dflt(bindHostname).subscribe((w, n) -> {
            String oldName = bindHostname;
            bindHostname = Coerce.toString(n);
            if (!Objects.equals(oldName, bindHostname)) {
                requestRestart();
            }
        });
    }

    @SuppressWarnings("UseSpecificCatch")
    @Override
    public void startup() throws InterruptedException {
        context = null;
        engineProvider = null;
        if (httpsEnabled) {
            if (!initializeHttps()) {
                return;
            }
        }

        logger.atInfo().log("Starting local dashboard server");
        dashboardServer = new DashboardServer(new InetSocketAddress(bindHostname, websocketPort), logger,
                kernel, deviceConfig, this, engineProvider, streamManagerAuthToken);
        dashboardServer.startup();
        try {
            // We need to wait for the server to startup before grabbing the port because it starts in a separate thread
            dashboardServer.getStarted().get();
        } catch (ExecutionException ignored) {
            // Not possible, we never throw anything
        }
        websocketPort = dashboardServer.getPort();
        logger.atInfo().addKeyValue("port", websocketPort).log("Finished starting websocket server");
        primaryGroup = new NioEventLoopGroup();
        secondaryGroup = new NioEventLoopGroup();
        try {
            final ServerBootstrap bootstrap =
                    new ServerBootstrap().group(primaryGroup, secondaryGroup).channel(NioServerSocketChannel.class)
                            .childHandler(new ChannelInitializerImpl(context)).option(ChannelOption.SO_BACKLOG,
                            128)
                            .childOption(ChannelOption.SO_KEEPALIVE, true);
            channel = bootstrap.bind(new InetSocketAddress(bindHostname, port)).sync();
        } catch (InterruptedException e) {
            logger.atError().setCause(e).log("Fail starting httpd");
            throw e;
        }
        logger.atInfo().addKeyValue("port", port).log("Finished starting httpd");

        reportState(State.RUNNING);
    }

    boolean initializeHttps() {
        Path workPath;
        KeyStore ks;
        try {
            workPath = kernel.getNucleusPaths().workPath(getServiceName());
            ks = KeyStore.getInstance("JKS");
        } catch (IOException | KeyStoreException e) {
            serviceErrored(e);
            return true;
        }

        // Get passphrase or generate a new one to use for the keystore password
        char[] passphrase = Coerce.toString(getRuntimeConfig().lookup("keystorePassphrase")
                .dflt(Utils.generateRandomString(24))).toCharArray();

        // Either load cert/key from keystore or create and then save to keystore for later
        Path keyStorePath = workPath.resolve("keystore.jks");
        try {
            if (Files.exists(keyStorePath)) {
                try (InputStream is = Files.newInputStream(keyStorePath)) {
                    ks.load(is, passphrase);
                } catch (IOException e) {
                    logger.warn(
                            "Failed to load self-signed certificate keystore. Reinitializing keystore automatically",
                            e);
                    Files.deleteIfExists(keyStorePath);
                    initializeKeyStore(ks, passphrase, keyStorePath);
                }
            } else {
                initializeKeyStore(ks, passphrase, keyStorePath);
            }
        } catch (IOException | NoSuchAlgorithmException | CertificateException
                | KeyStoreException | OperatorCreationException e) {
            serviceErrored(e);
            return false;
        }

        try {
            // Grab key and cert for SSL setup
            PrivateKey privateKey = (PrivateKey) ks.getKey(PRIVATE_KEY_NAME, new char[0]);
            X509Certificate cert = (X509Certificate) ks.getCertificate(CERT_NAME);
            context = SslContextBuilder.forServer(privateKey, cert).build();
            SslContext finalContext = context;
            engineProvider = () -> finalContext.newEngine(ByteBufAllocator.DEFAULT);

            // Save certificate fingerprint as space separated hex bytes
            String fingerprint = fingerprintCert(cert, SHA_1_ALGORITHM);
            config.getRoot().lookup(CERT_FINGERPRINT_NAMESPACE, SHA_1_ALGORITHM).withValue(fingerprint);
            fingerprint = fingerprintCert(cert, SHA_256_ALGORITHM);
            config.getRoot().lookup(CERT_FINGERPRINT_NAMESPACE, SHA_256_ALGORITHM).withValue(fingerprint);
        } catch (NoSuchAlgorithmException | CertificateEncodingException
                | KeyStoreException | UnrecoverableKeyException | SSLException e) {
            serviceErrored(e);
            return false;
        }
        return true;
    }

    private void initializeKeyStore(KeyStore ks, char[] passphrase, Path keyStorePath)
            throws IOException, NoSuchAlgorithmException, CertificateException, OperatorCreationException,
            KeyStoreException {
        // Initialize keystore as empty
        ks.load(null, passphrase);

        // Generate keys and certificate
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(4096, new SecureRandom());
        KeyPair keyPair = keyGen.generateKeyPair();
        X509Certificate cert = selfSign(keyPair, bindHostname);

        ks.setCertificateEntry(CERT_NAME, cert);
        ks.setKeyEntry(PRIVATE_KEY_NAME, keyPair.getPrivate(), new char[0], new Certificate[]{cert});
        try (OutputStream os = Files.newOutputStream(keyStorePath)) {
            ks.store(os, passphrase);
        }
    }

    static String fingerprintCert(X509Certificate cert, String algorithm)
            throws NoSuchAlgorithmException, CertificateEncodingException {
        StringBuilder sb = new StringBuilder();
        for (byte b : MessageDigest.getInstance(algorithm).digest(cert.getEncoded())) {
            sb.append(String.format("%02X ", b));
        }
        return sb.toString().trim();
    }

    private static X509Certificate selfSign(KeyPair keyPair, String subjectDN) throws OperatorCreationException,
            CertificateException,
            IOException
    {
        java.security.Provider bcProvider = new BouncyCastleProvider();
        Security.addProvider(bcProvider);

        long now = System.currentTimeMillis() - TimeUnit.SECONDS.toMillis(60);
        Date startDate = new Date(now);

        X500Name dnName = new X500Name("cn=" + subjectDN);
        BigInteger certSerialNumber = new BigInteger(Long.toString(now)); // Using the current timestamp as the certificate serial number

        Calendar calendar = Calendar.getInstance();
        calendar.setTime(startDate);
        calendar.add(Calendar.YEAR, 10); // 10 year validity period
        Date endDate = calendar.getTime();

        String signatureAlgorithm = "SHA256WithRSA";
        ContentSigner contentSigner = new JcaContentSignerBuilder(signatureAlgorithm).build(keyPair.getPrivate());
        JcaX509v3CertificateBuilder
                certBuilder = new JcaX509v3CertificateBuilder(dnName, certSerialNumber, startDate,
                endDate, dnName, keyPair.getPublic());
        BasicConstraints basicConstraints = new BasicConstraints(false);
        // Required basic constraints OID. Must be present to be recognized as a proper certificate by browsers
        certBuilder.addExtension(new ASN1ObjectIdentifier("2.5.29.19"), true, basicConstraints);

        return new JcaX509CertificateConverter().setProvider(bcProvider).getCertificate(certBuilder.build(contentSigner));
    }

    @Override
    public void shutdown() throws InterruptedException {
        logger.atInfo().log("Shutting down httpd");
        secondaryGroup.shutdownGracefully();
        primaryGroup.shutdownGracefully();
        try {
            if (dashboardServer != null) {
                dashboardServer.stop();
            }
        } catch (Exception e) {
            serviceErrored(e);
        }

        if (channel != null) {
            channel.channel().close().sync();
        }
    }

    private class ChannelInitializerImpl extends ChannelInitializer<SocketChannel> {
        private final SslContext sslContext;

        public ChannelInitializerImpl(SslContext sslContext) {
            this.sslContext = sslContext;
        }

        @Override
        public void initChannel(final SocketChannel ch) throws Exception {
            if (sslContext != null) {
                ch.pipeline().addFirst("ssl", sslContext.newHandler(ch.alloc()));
            }
            ch.pipeline().addLast("codec", new HttpServerCodec());
            ch.pipeline().addLast("aggregator", new HttpObjectAggregator(512 * 1024));
            ch.pipeline().addLast("request", new PageHandler());
        }
    }

    static final byte[] missing = {1, 2, 3};

    @SuppressWarnings("UseSpecificCatch")
    public class PageHandler extends ChannelInboundHandlerAdapter {

        /**
         * URI == prefix/basename.ext?query
         */
        public String uri;
        Map<String, String> qparams = Collections.emptyMap();
        public String name;
        public String prefix;
        public String ext;
        public String basename;
        public FullHttpRequest request;

        @Override
        public void channelRead(ChannelHandlerContext ctx, Object msg) {
            if (msg instanceof FullHttpRequest) {
                request = (FullHttpRequest) msg;
                try {
                    uri = request.uri();
                    while (uri.startsWith("/")) {
                        uri = uri.substring(1);
                    }
                    int qpos = uri.indexOf('?');
                    if (qpos >= 0) {
                        qparams = parseQuery(uri.substring(qpos + 1));
                        uri = uri.substring(0, qpos);
                    }
                    int lsl = uri.lastIndexOf('/');
                    if (lsl >= 0) {
                        name = uri.substring(lsl + 1);
                        prefix = uri.substring(0, lsl);
                    } else {
                        name = uri;
                        prefix = "";
                    }
                    name = name.replace('-', '_');
                    int epos = name.lastIndexOf('.');
                    if (epos >= 0) {
                        ext = name.substring(epos + 1);
                        basename = name.substring(0, epos);
                    } else {
                        ext = "json";
                        basename = name;
                        if (isEmpty(basename)) {
                            basename = "index";
                            ext = "html";
                        }
                    }
                    String authHeader = request.headers().get(HttpHeaderNames.AUTHORIZATION);
                    if (!authenticated(authHeader)) {
                        logger.atWarn().log("Failed to authenticate request from {}", ctx.channel().remoteAddress());
                        FullHttpResponse response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.UNAUTHORIZED);
                        response.headers().set(HttpHeaderNames.WWW_AUTHENTICATE,
                                "Basic realm=\"Greengrass View\", charset=\"UTF-8\"");
                        response.headers().set(HttpHeaderNames.CONTENT_LENGTH, 0);

                        ctx.writeAndFlush(response);
                        return;
                    }
                    logger.atDebug().kv("URI", uri).log("Incoming request");

                    byte[] blob = this.getBlobForURI(uri, getUsernameAndPassword(authHeader));
                    String mime = ext2mime(ext);

                    if (blob != missing) {
                        ByteBuf bb = copiedBuffer(blob);
                        FullHttpResponse response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.OK, bb);
                        response.headers().set(HttpHeaderNames.CONTENT_TYPE, mime);
                        response.headers().set(HttpHeaderNames.CONTENT_LENGTH, bb.writerIndex());
                        ctx.writeAndFlush(response);
                        return;
                    }

                    FullHttpResponse response =
                            new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.NOT_FOUND,
                                    copiedBuffer("Not Found".getBytes(StandardCharsets.UTF_8)));
                    if (HttpUtil.isKeepAlive(request)) {
                        response.headers().set(HttpHeaderNames.CONNECTION, HttpHeaderValues.KEEP_ALIVE);
                    }
                    ctx.writeAndFlush(response);
                } finally {
                    request.release();
                }
            } else {
                try {
                    super.channelRead(ctx, msg);
                } catch (Exception ex) {
                    logger.atError().setCause(ex).log("SimpleHttpServer.channelRead");
                }
            }
        }

        public SimpleHttpServer getServer() {
            return SimpleHttpServer.this;
        }

        public Logger getLogger() {
            return logger;
        }

        @Override
        public void channelReadComplete(ChannelHandlerContext ctx) throws Exception {
            ctx.flush();
        }

        @Override
        public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
            ctx.writeAndFlush(
                    new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.INTERNAL_SERVER_ERROR,
                            copiedBuffer(cause.getMessage().getBytes())));
        }

        private byte[] getBlobForURI(String uri, Pair<String, String> usernameAndPassword) {
            try {
                if (isEmpty(uri) || "/".equals(uri)) {
                    uri = "index.html";
                }
                URL u = this.getClass().getClassLoader().getResource("node/dashboard-frontend/" + uri);
                if (u == null) {
                    return missing;
                }
                try (InputStream in = u.openStream()) {
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    byte[] buf = new byte[1024];
                    int nread;
                    while ((nread = in.read(buf)) > 0) {
                        bos.write(buf, 0, nread);
                    }
                    return bos.toString(StandardCharsets.UTF_8.name())
                            .replace("%WEBSOCKET_PORT%", Integer.toString(websocketPort))
                            .replace("%USERNAME%", usernameAndPassword.getLeft())
                            .replace("%PASSWORD%", usernameAndPassword.getRight())
                            .replace("%CHINA_PARTITION%",
                                    String.valueOf("aws-cn"
                                            .equals(Region.of(Coerce.toString(deviceConfig.getAWSRegion())).metadata()
                                                    .partition().id())))
                            .getBytes(StandardCharsets.UTF_8);
                }
            } catch (Throwable t) {
                logger.atError().setCause(t).log("Error loading HTTP blob");
                serviceErrored(t);
                return missing;
            }
        }
    }

    private boolean authenticated(String authHeader) {
        Pair<String, String> usernameAndPassword = getUsernameAndPassword(authHeader);
        return usernameAndPassword != null && isUsernameAndPasswordValid(usernameAndPassword);
    }

    @Override
    public boolean isUsernameAndPasswordValid(Pair<String, String> usernameAndPassword) {
        Topics passwordTopics = config.getRoot().findTopics(DEBUG_PASSWORD_NAMESPACE);
        if (passwordTopics == null || usernameAndPassword == null) {
            return false;
        }

        // Cleanup any expired passwords first
        // foreach user
        passwordTopics.forEach(n -> {
            if (n instanceof Topics) {
                // foreach password under the user
                ((Topics) n).forEach(p -> {
                    if (p instanceof Topics) {
                        Topic exp = ((Topics) p).find(EXPIRATION_NAMESPACE);
                        // If there's somehow no expiration set or if it has expired already, then remove it from the
                        // store
                        if (exp == null || Instant.now().isAfter(Instant.ofEpochMilli(Coerce.toLong(exp)))) {
                            p.remove();
                        }
                    }
                });
            }
        });

        // Verify this incoming request
        Topic expirationTopic = passwordTopics.find(usernameAndPassword.getLeft(), usernameAndPassword.getRight(),
                EXPIRATION_NAMESPACE);
        if (expirationTopic == null) {
            return false;
        }
        return Instant.now().isBefore(Instant.ofEpochMilli(Coerce.toLong(expirationTopic)));
    }

    private Pair<String, String> getUsernameAndPassword(String authHeader) {
        if (Utils.isEmpty(authHeader)) {
            return null;
        }
        String[] head = authHeader.split("Basic ");
        if (head.length != 2) {
            return null;
        }
        try {
            String[] uncoded = new String(Base64.getDecoder().decode(head[1]), StandardCharsets.UTF_8).split(":");
            if (uncoded.length != 2) {
                return null;
            }
            return new Pair<>(uncoded[0], uncoded[1]);
        } catch (IllegalArgumentException i) {
            return null;
        }
    }

    public static HttpResponseStatus herr(String msg) {
        return new HttpResponseStatus(HttpResponseStatus.INTERNAL_SERVER_ERROR.code(), msg);
    }

    // I hate that I'm building this table manually
    static final HashMap<String, String> ext2mime = new HashMap<>();

    private static void m(String m, String... x) {
        for (String xx : x) {
            ext2mime.put(xx, m);
        }
    }

    public static Map<String, String> parseQuery(String q) {
        if (q == null || q.length() == 0) {
            return Collections.emptyMap();
        }
        HashMap<String, String> m = new LinkedHashMap<>();
        Matcher p = qparam.matcher(q);
        while (!p.hitEnd() && p.lookingAt()) {
            String k = p.group(1);
            String v = p.group(3);
            m.put(k, v == null ? "" : v);
            assert p.end() > p.regionStart();  // cannot loop infinitely
            p.region(p.end(), p.regionEnd());
        }
        return m.isEmpty() ? Collections.emptyMap() : m;
    }

    private static final Pattern qparam = Pattern.compile("([^=&]+)(=([^&]*))?&*");


    public static double parseNumber(Map<String, String> query, String key, double dflt) {
        String v = query.get(key);
        return v == null ? dflt : Coerce.toDouble(v);
    }

    public static String ext2mime(String ext) {
        String ret = ext2mime.get(ext);
        return ret == null ? "text/plain" : ret;
    }

    static {
        m("image/jpeg", "jpeg", "jpg", "jpe", "jfif");
        m("image/png", "png");
        m("image/gif", "gif");
        m("image/svg", "svg");
        m("text/plain", "txt");
        m("application/json", "json");
        m("application/pdf", "pdf", "ai");
        m("image/tiff", "tiff", "tif");
        m("image/x-icon", "ico");
        m("text/html", "html", "htm");
        m("text/x-yaml", "yaml", "yml", "yam");
        m("text/css", "css");
    }
}
