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
import com.aws.greengrass.lifecyclemanager.GreengrassService;
import com.aws.greengrass.lifecyclemanager.Kernel;
import com.aws.greengrass.lifecyclemanager.PluginService;
import com.aws.greengrass.logging.api.Logger;
import com.aws.greengrass.util.Coerce;
import com.aws.greengrass.util.Pair;
import com.aws.greengrass.util.Utils;
import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.ByteBuf;
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

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.inject.Inject;

import static com.aws.greengrass.componentmanager.KernelConfigResolver.CONFIGURATION_CONFIG_KEY;
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
    protected static final String DEBUG_PASSWORD_NAMESPACE = "_debugPassword";
    protected static final String EXPIRATION_NAMESPACE = "expiration";
    private ChannelFuture channel;
    private final EventLoopGroup primaryGroup = new NioEventLoopGroup();
    private final EventLoopGroup secondaryGroup = new NioEventLoopGroup();
    private static final int DEFAULT_HTTP_PORT = 1441;
    private static final int DEFAULT_WEBSOCKET_PORT = 1442;
    private int port = DEFAULT_HTTP_PORT;

    private final Kernel kernel;
    private final DeviceConfiguration deviceConfig;

    private DashboardServer dashboardServer;
    private int websocketPort = DEFAULT_WEBSOCKET_PORT;
    private String bindHostname = "localhost";

    @Inject
    public SimpleHttpServer(Topics t, Kernel kernel, DeviceConfiguration deviceConfiguration) {
        super(t);
        this.kernel = kernel;
        this.deviceConfig = deviceConfiguration;
    }

    @Override
    public void postInject() {
        super.postInject();
        config.lookup(CONFIGURATION_CONFIG_KEY, "port").dflt(port).subscribe((w, n) -> {
            port = Coerce.toInt(n);
            if (port < 1000) {
                logger.atWarn().kv("port", port).kv("defaultPort", DEFAULT_HTTP_PORT)
                        .log("Port number should not be smaller than 1000. Using default.");
                port = DEFAULT_HTTP_PORT;
            }
            // TODO: should restart server on new port
        });
        config.lookup(CONFIGURATION_CONFIG_KEY, "websocketPort").dflt(websocketPort).subscribe((w, n) -> {
            websocketPort = Coerce.toInt(n);
            if (port < 1000) {
                logger.atWarn().kv("websocketPort", port).kv("defaultWebsocketPort", DEFAULT_WEBSOCKET_PORT)
                        .log("Websocket port number should not be smaller than 1000. Using default.");
                websocketPort = DEFAULT_WEBSOCKET_PORT;
            }
            // TODO: should restart server on new port
        });
        config.lookup(CONFIGURATION_CONFIG_KEY, "bindHostname").dflt(bindHostname).subscribe((w, n) -> {
            bindHostname = Coerce.toString(n);
        });
        context.addGlobalStateChangeListener((s, w, n) -> addTimelineEntry(s, w));
    }

    @SuppressWarnings("UseSpecificCatch")
    @Override
    public void startup() throws InterruptedException {
        logger.atInfo().log("Starting local dashboard server");
        dashboardServer = new DashboardServer(new InetSocketAddress(bindHostname, websocketPort), logger,
                kernel, deviceConfig, this);
        dashboardServer.startup();
        try {
            // We need to wait for the server to startup before grabbing the port because it starts in a separate thread
            dashboardServer.getStarted().get();
        } catch (ExecutionException ignored) {
            // Not possible, we never throw anything
        }
        websocketPort = dashboardServer.getPort();
        logger.atInfo().addKeyValue("port", websocketPort).log("Finished starting websocket server");

        try {
            final ServerBootstrap bootstrap =
                    new ServerBootstrap().group(primaryGroup, secondaryGroup).channel(NioServerSocketChannel.class)
                            .childHandler(new ChannelInitializerImpl()).option(ChannelOption.SO_BACKLOG, 128)
                            .childOption(ChannelOption.SO_KEEPALIVE, true);
            channel = bootstrap.bind(new InetSocketAddress(bindHostname, port)).sync();
        } catch (InterruptedException e) {
            logger.atError().setCause(e).log("Fail starting httpd");
            throw e;
        }
        logger.atInfo().addKeyValue("port", port).log("Finished starting httpd");

        reportState(State.RUNNING);
    }

    @Override
    public void shutdown() throws InterruptedException {
        logger.atInfo().log("Shutting down httpd");
        secondaryGroup.shutdownGracefully();
        primaryGroup.shutdownGracefully();
        try {
            dashboardServer.stop();
        } catch (Exception e) {
            logger.atError().setCause(e).log("Error shutting down local dashboard server");
            serviceErrored(e);
        }

        if (channel != null) {
            channel.channel().close().sync();
        }
    }

    // TODO break the timeline out to its own class
    private void addTimelineEntry(GreengrassService s, State w) {
        Queue<stateTimelineEntry> stl = timeline.computeIfAbsent(s, s2 -> new ConcurrentLinkedDeque<>());
        stl.add(new stateTimelineEntry(s, w));
    }

    private final ConcurrentHashMap<GreengrassService, Queue<stateTimelineEntry>> timeline = new ConcurrentHashMap<>();

    public void forEachTransition(GreengrassService s, long min, long max, consumeTimelineEntry func) {
        Queue<stateTimelineEntry> q = timeline.get(s);
        if (q != null) {
            AtomicReference<stateTimelineEntry> preroll = new AtomicReference<>();
            q.forEach(tle -> {
                if (tle.T < max) {
                    if (tle.T >= min) {
                        if (preroll.get() != null) {
                            func.preroll(preroll.get());
                            preroll.set(null);
                        }
                        func.accept(tle);
                    } else {
                        preroll.set(tle);
                    }
                }
            });
            if (preroll.get() != null) {
                func.preroll(preroll.get());
            }
            func.done();
        }
    }

    public static class stateTimelineEntry {

        public final State was;
        public final State is;
        public final GreengrassService s;
        public final long T;
        private static long prevT;

        stateTimelineEntry(GreengrassService s, State was) {
            this.was = was;
            this.s = s;
            is = s.getState();
            T = Math.max(System.currentTimeMillis(), prevT + 1);
            prevT = T;
        }
    }

    public interface consumeTimelineEntry {

        public void preroll(stateTimelineEntry tle);

        public void accept(stateTimelineEntry tle);

        public void done();
    }

    private class ChannelInitializerImpl extends ChannelInitializer<SocketChannel> {
        @Override
        public void initChannel(final SocketChannel ch) throws Exception {
            ch.pipeline().addLast("codec", new HttpServerCodec());
            ch.pipeline().addLast("aggregator", new HttpObjectAggregator(512 * 1024));
            ch.pipeline().addLast("request", new PageHandler());
        }
    }

    static final ConcurrentHashMap<String, byte[]> bcache = new ConcurrentHashMap<>();
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
                            new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.NOT_FOUND, null);
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

        public String getRequestBody() {
            return request.content().toString(StandardCharsets.UTF_8);
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
            assert p.end() > p.regionStart();  // cannot loop infinely
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
